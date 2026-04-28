`timescale 1ns / 1ps

module bi_uart_test #(
    parameter CLK_FREQ = 50_000_000, 
    parameter BAUD_RATE = 115200
)(
    input  wire        CLOCK_50,
    
    // Giao tiếp ESP32
    input  wire        rx_in,
    output wire        tx_out,
    
    // Ngoại vi
    input  wire [3:0]  KEY,
    input  wire [17:0] SW,
    output reg  [8:0]  LEDG,
    output reg  [17:0] LEDR,
    output reg  [6:0]  HEX0, HEX1, HEX2, HEX3, HEX4, HEX5, HEX6, HEX7,
    
    // Nâng cấp LCD
    output wire [7:0]  LCD_DATA,
    output wire        LCD_EN,
    output wire        LCD_RS,
    output wire        LCD_RW,
    output wire        LCD_ON
);

    reg [255:0] lcd_msg; // Bộ nhớ 32 kí tự

    // Nhúng khối điều khiển chữ chạy
    lcd_marquee u_lcd (
        .clk(CLOCK_50),
        .msg(lcd_msg),
        .LCD_DATA(LCD_DATA),
        .LCD_EN(LCD_EN),
        .LCD_RS(LCD_RS),
        .LCD_RW(LCD_RW),
        .LCD_ON(LCD_ON)
    );

    // ==========================================
    // 1. MẠCH NHẬN (UART RX): ESP32 -> FPGA
    // ==========================================
    localparam CLOCKS_PER_BIT = CLK_FREQ / BAUD_RATE;
    
    reg rx_sync1, rx_sync2;
    always @(posedge CLOCK_50) begin
        rx_sync1 <= rx_in;
        rx_sync2 <= rx_sync1;
    end

    reg [2:0] rx_state;
    reg [15:0] rx_clk_count;
    reg [2:0] rx_bit_index;
    reg [7:0] rx_raw_data;
    
    // Khung nhận dữ liệu 46 byte: [0xAA] [13 bytes Đèn] [32 bytes LCD]
    reg [5:0] packet_index; 

    always @(posedge CLOCK_50) begin
        case (rx_state)
            0: begin // IDLE
                rx_clk_count <= 0;
                rx_bit_index <= 0;
                if (rx_sync2 == 0) rx_state <= 1; // Start bit
            end
            1: begin // START WAIT
                if (rx_clk_count == CLOCKS_PER_BIT/2) begin
                    rx_clk_count <= 0;
                    if (rx_sync2 == 0) rx_state <= 2;
                    else rx_state <= 0;
                end else rx_clk_count <= rx_clk_count + 1;
            end
            2: begin // DATA BITS
                if (rx_clk_count < CLOCKS_PER_BIT - 1) rx_clk_count <= rx_clk_count + 1;
                else begin
                    rx_clk_count <= 0;
                    rx_raw_data[rx_bit_index] <= rx_sync2;
                    if (rx_bit_index < 7) rx_bit_index <= rx_bit_index + 1;
                    else begin
                        rx_bit_index <= 0;
                        rx_state <= 3;
                    end
                end
            end
            3: begin // STOP BIT & PROCESSING
                if (rx_clk_count < CLOCKS_PER_BIT/2) rx_clk_count <= rx_clk_count + 1;
                else begin
                    rx_state <= 0; // Xong 1 byte
                    
                    if (packet_index == 0) begin
                        if (rx_raw_data == 8'hAA) packet_index <= 1; // Bắt đầu gói tin đúng chuẩn
                    end else begin
                        case (packet_index)
                            1: LEDG[7:0]   <= rx_raw_data;
                            2: LEDG[8]     <= rx_raw_data[0];
                            3: LEDR[7:0]   <= rx_raw_data;
                            4: LEDR[15:8]  <= rx_raw_data;
                            5: LEDR[17:16] <= rx_raw_data[1:0];
                            6: HEX0        <= rx_raw_data[6:0];
                            7: HEX1        <= rx_raw_data[6:0];
                            8: HEX2        <= rx_raw_data[6:0];
                            9: HEX3        <= rx_raw_data[6:0];
                            10: HEX4       <= rx_raw_data[6:0];
                            11: HEX5       <= rx_raw_data[6:0];
                            12: HEX6       <= rx_raw_data[6:0];
                            13: HEX7       <= rx_raw_data[6:0];
                            default: begin 
                                // Các byte từ 14 đến 45 nhồi dần vào chuỗi LCD qua hiệu ứng Dịch trái (Shift Left)
                                if (packet_index >= 14 && packet_index <= 45) begin
                                    lcd_msg <= {lcd_msg[247:0], rx_raw_data};
                                end
                            end
                        endcase
                        
                        if (packet_index == 45) packet_index <= 0; // Reset và quay lại chờ gói mới
                        else packet_index <= packet_index + 1;
                    end
                end // kết thúc xử lý gói 
            end
        endcase
    end

    // ==========================================
    // 2. MẠCH GỬI (UART TX): FPGA -> ESP32
    // ==========================================
    reg [2:0] tx_state;
    reg [15:0] tx_clk_count;
    reg [2:0] tx_bit_index;
    reg [7:0] tx_data_out;
    reg tx_reg;
    assign tx_out = tx_reg;

    reg [23:0] timer_50ms;
    reg [2:0] send_index; 
    
    always @(posedge CLOCK_50) begin
        if (timer_50ms < 2_500_000) begin
            timer_50ms <= timer_50ms + 1;
        end

        case (tx_state)
            0: begin 
                tx_reg <= 1;
                tx_clk_count <= 0;
                tx_bit_index <= 0;
                
                if (timer_50ms >= 2_500_000) begin
                    timer_50ms <= 0;
                    send_index <= 1; 
                    tx_state <= 1;
                    tx_data_out <= 8'hBB; 
                end
                else if (send_index > 0) begin
                    tx_state <= 1;
                    case (send_index)
                        2: tx_data_out <= {4'b0, ~KEY[3:0]}; 
                        3: tx_data_out <= SW[7:0];
                        4: tx_data_out <= SW[15:8];
                        5: tx_data_out <= {6'b0, SW[17:16]};
                    endcase
                end
            end
            
            1: begin 
                tx_reg <= 0; 
                if (tx_clk_count < CLOCKS_PER_BIT - 1) tx_clk_count <= tx_clk_count + 1;
                else begin tx_clk_count <= 0; tx_state <= 2; end
            end
            
            2: begin 
                tx_reg <= tx_data_out[tx_bit_index];
                if (tx_clk_count < CLOCKS_PER_BIT - 1) tx_clk_count <= tx_clk_count + 1;
                else begin
                    tx_clk_count <= 0;
                    if (tx_bit_index < 7) tx_bit_index <= tx_bit_index + 1;
                    else begin tx_bit_index <= 0; tx_state <= 3; end
                end
            end
            
            3: begin 
                tx_reg <= 1;
                if (tx_clk_count < CLOCKS_PER_BIT - 1) tx_clk_count <= tx_clk_count + 1;
                else begin
                    tx_clk_count <= 0;
                    if (send_index == 5) send_index <= 0; 
                    else send_index <= send_index + 1;    
                    tx_state <= 0;
                end
            end
        endcase
    end

    initial begin
        LEDG = 9'b111111111;
        LEDR = 18'h3FFFF;
        HEX0 = 7'b0111111; HEX1 = 7'b0111111; HEX2 = 7'b0111111; HEX3 = 7'b0111111;
        HEX4 = 7'b0111111; HEX5 = 7'b0111111; HEX6 = 7'b0111111; HEX7 = 7'b0111111;
        lcd_msg = 256'h2020202020202020202020202020202020202020202020202020202020202020; // 32 Dấu cách trắng
        packet_index = 0;
        send_index = 0;
        tx_state = 0;
        rx_state = 0;
    end

endmodule
