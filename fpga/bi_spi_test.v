`timescale 1ns / 1ps

module bi_spi_test (
    input  wire        CLOCK_50,
    
    // Giao tiếp SPI (ESP32 Master -> FPGA Slave)
    input  wire        spi_sck,   
    input  wire        spi_cs,    
    input  wire        spi_mosi,  
    output wire        spi_miso,  
    
    // Ngoại vi
    input  wire [3:0]  KEY,
    input  wire [17:0] SW,
    output reg  [8:0]  LEDG,
    output reg  [17:0] LEDR,
    output reg  [6:0]  HEX0, HEX1, HEX2, HEX3, HEX4, HEX5, HEX6, HEX7,
    
    // LCD 16x2
    output wire [7:0]  LCD_DATA,
    output wire        LCD_EN,
    output wire        LCD_RS,
    output wire        LCD_RW,
    output wire        LCD_ON
);

    reg [255:0] lcd_msg; 

    lcd_marquee u_lcd (
        .clk(CLOCK_50),
        .msg(lcd_msg),
        .LCD_DATA(LCD_DATA),
        .LCD_EN(LCD_EN),
        .LCD_RS(LCD_RS),
        .LCD_RW(LCD_RW),
        .LCD_ON(LCD_ON)
    );

    reg [2:0] sck_r, cs_r, mosi_r;
    always @(posedge CLOCK_50) begin
        sck_r  <= {sck_r[1:0],  spi_sck};
        cs_r   <= {cs_r[1:0],   spi_cs};
        mosi_r <= {mosi_r[1:0], spi_mosi};
    end
    
    wire sck_risingedge  = (sck_r[2:1]  == 2'b01); 
    wire sck_fallingedge = (sck_r[2:1]  == 2'b10); 
    wire cs_active       = ~cs_r[1]; 
    wire mosi_data       = mosi_r[1];

    reg [2:0]  bit_cnt;
    reg [5:0]  byte_cnt;
    reg [7:0]  rx_byte;
    reg [7:0]  tx_byte;
    
    reg        byte_received; 
    reg [7:0]  latched_byte;  

    // ==========================================
    // SỬA LỖI MẤT KẾT NỐI MISO: 
    // MISO phải được đẩy ra NGAY TRƯỚC khi có xung nhịp đầu tiên (SPI Mode 0 CPHA=0)
    // Thay vì đợi SCK, ta nối cứng MISO luôn bắt trọn bit 7 của tx_byte
    // ==========================================
    assign spi_miso = cs_active ? tx_byte[7] : 1'bz;

    wire [7:0] tx_data_array [0:4];
    assign tx_data_array[0] = 8'hBB; 
    assign tx_data_array[1] = {4'b0, ~KEY[3:0]};
    assign tx_data_array[2] = SW[7:0];
    assign tx_data_array[3] = SW[15:8];
    assign tx_data_array[4] = {6'b0, SW[17:16]};

    always @(posedge CLOCK_50) begin
        if (~cs_active) begin 
            bit_cnt  <= 0;
            byte_cnt <= 0;
            tx_byte  <= tx_data_array[0]; 
            byte_received <= 0;
        end 
        else begin 
            // 1. Phân bổ dữ liệu RX nhận được
            if (byte_received) begin
                byte_received <= 0; 
                
                case (byte_cnt)
                    0: ; 
                    1: LEDG[7:0]   <= latched_byte;
                    2: LEDG[8]     <= latched_byte[0];
                    3: LEDR[7:0]   <= latched_byte;
                    4: LEDR[15:8]  <= latched_byte;
                    5: LEDR[17:16] <= latched_byte[1:0];
                    6:  HEX0       <= latched_byte[6:0];
                    7:  HEX1       <= latched_byte[6:0];
                    8:  HEX2       <= latched_byte[6:0];
                    9:  HEX3       <= latched_byte[6:0];
                    10: HEX4       <= latched_byte[6:0];
                    11: HEX5       <= latched_byte[6:0];
                    12: HEX6       <= latched_byte[6:0];
                    13: HEX7       <= latched_byte[6:0];
                    default: begin
                        if (byte_cnt >= 14 && byte_cnt <= 45) begin
                            lcd_msg <= {lcd_msg[247:0], latched_byte};
                        end
                    end
                endcase
                
                byte_cnt <= byte_cnt + 1;
            end

            // 2. Thu bit từ ESP32 (MOSI) vào cạnh SÁNG
            if (sck_risingedge) begin
                rx_byte <= {rx_byte[6:0], mosi_data};
                if (bit_cnt == 7) begin 
                    bit_cnt <= 0;
                    latched_byte <= {rx_byte[6:0], mosi_data}; 
                    byte_received <= 1; 
                end else begin
                    bit_cnt <= bit_cnt + 1;
                end
            end
            
            // 3. Phun bit trả về ESP32 (MISO) vào cạnh TỐI
            if (sck_fallingedge) begin
                if (bit_cnt == 0) begin
                    // Đang ở ranh giới giữa 2 byte. bit_cnt vừa qua 7 và bị ép bằng 0.
                    // Nạp nguyên đạn đạo mới thay vì dịch, để bảo toàn bit số 7 cho nhịp lấy thứ nhất của Master
                    if (byte_cnt < 4) tx_byte <= tx_data_array[byte_cnt];
                    else tx_byte <= 8'h00;
                end else begin
                    // Đang chạy ở lưng chừng byte thì gọt bit trái dịch sang
                    tx_byte  <= {tx_byte[6:0], 1'b0};
                end
            end
        end
    end

    initial begin
        LEDG = 9'b111111111; LEDR = 18'h3FFFF; 
        HEX0 = 7'b0111111; HEX1 = 7'b0111111; HEX2 = 7'b0111111; HEX3 = 7'b0111111; HEX4 = 7'b0111111; HEX5 = 7'b0111111; HEX6 = 7'b0111111; HEX7 = 7'b0111111;
        lcd_msg = 256'h2020202020202020202020202020202020202020202020202020202020202020;
    end

endmodule
