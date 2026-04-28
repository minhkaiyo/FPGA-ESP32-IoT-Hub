`timescale 1ns / 1ps

module esp32_web_fpga_control (
    input  wire        CLOCK_50,

    // ESP32 is SPI master, FPGA is SPI slave. Use SPI mode 0.
    input  wire        spi_sck,
    input  wire        spi_cs,
    input  wire        spi_mosi,
    output wire        spi_miso,

    input  wire [3:0]  KEY,
    input  wire [17:0] SW,
    output reg  [8:0]  LEDG,
    output reg  [17:0] LEDR,
    output reg  [6:0]  HEX0,
    output reg  [6:0]  HEX1,
    output reg  [6:0]  HEX2,
    output reg  [6:0]  HEX3,
    output reg  [6:0]  HEX4,
    output reg  [6:0]  HEX5,
    output reg  [6:0]  HEX6,
    output reg  [6:0]  HEX7,

    output wire [7:0]  LCD_DATA,
    output wire        LCD_EN,
    output wire        LCD_RS,
    output wire        LCD_RW,
    output wire        LCD_ON
);

    localparam [5:0] FRAME_BYTES = 6'd46;
    localparam [5:0] FRAME_LAST  = 6'd45;

    reg [255:0] lcd_msg;

    esp32_web_lcd_marquee u_lcd (
        .clk(CLOCK_50),
        .msg(lcd_msg),
        .LCD_DATA(LCD_DATA),
        .LCD_EN(LCD_EN),
        .LCD_RS(LCD_RS),
        .LCD_RW(LCD_RW),
        .LCD_ON(LCD_ON)
    );

    reg [2:0] sck_sync;
    reg [2:0] cs_sync;
    reg [2:0] mosi_sync;

    always @(posedge CLOCK_50) begin
        sck_sync  <= {sck_sync[1:0], spi_sck};
        cs_sync   <= {cs_sync[1:0], spi_cs};
        mosi_sync <= {mosi_sync[1:0], spi_mosi};
    end

    wire cs_active = ~cs_sync[1];
    wire sck_rise  = (sck_sync[2:1] == 2'b01);
    wire sck_fall  = (sck_sync[2:1] == 2'b10);
    wire mosi_bit  = mosi_sync[1];

    reg [2:0] bit_count;
    reg [5:0] byte_count;
    reg [7:0] rx_shift;
    reg [7:0] rx_byte;
    reg       rx_ready;
    reg [7:0] tx_shift;

    assign spi_miso = cs_active ? tx_shift[7] : 1'bz;

    function [7:0] status_byte;
        input [5:0] index;
        begin
            case (index)
                6'd0: status_byte = 8'hBB;
                6'd1: status_byte = {4'b0000, ~KEY};
                6'd2: status_byte = SW[7:0];
                6'd3: status_byte = SW[15:8];
                6'd4: status_byte = {6'b000000, SW[17:16]};
                default: status_byte = 8'h00;
            endcase
        end
    endfunction

    task apply_frame_byte;
        input [5:0] index;
        input [7:0] data;
        begin
            case (index)
                6'd0: begin
                    // Sync byte from ESP32. Kept for framing, no output change.
                end
                6'd1:  LEDG[7:0]   <= data;
                6'd2:  LEDG[8]     <= data[0];
                6'd3:  LEDR[7:0]   <= data;
                6'd4:  LEDR[15:8]  <= data;
                6'd5:  LEDR[17:16] <= data[1:0];
                6'd6:  HEX0        <= ~data[6:0];  // Active-LOW on DE2i-150
                6'd7:  HEX1        <= ~data[6:0];
                6'd8:  HEX2        <= ~data[6:0];
                6'd9:  HEX3        <= ~data[6:0];
                6'd10: HEX4        <= ~data[6:0];
                6'd11: HEX5        <= ~data[6:0];
                6'd12: HEX6        <= ~data[6:0];
                6'd13: HEX7        <= ~data[6:0];
                default: begin
                    if (index >= 6'd14 && index < FRAME_BYTES) begin
                        lcd_msg <= {lcd_msg[247:0], data};
                    end
                end
            endcase
        end
    endtask

    always @(posedge CLOCK_50) begin
        if (!cs_active) begin
            bit_count  <= 3'd0;
            byte_count <= 6'd0;
            rx_shift   <= 8'd0;
            rx_ready   <= 1'b0;
            tx_shift   <= status_byte(6'd0);
        end else begin
            if (rx_ready) begin
                rx_ready <= 1'b0;
                apply_frame_byte(byte_count, rx_byte);
                if (byte_count == FRAME_LAST) begin
                    byte_count <= 6'd0;
                end else begin
                    byte_count <= byte_count + 1'b1;
                end
            end

            if (sck_rise) begin
                rx_shift <= {rx_shift[6:0], mosi_bit};
                if (bit_count == 3'd7) begin
                    rx_byte   <= {rx_shift[6:0], mosi_bit};
                    rx_ready  <= 1'b1;
                    bit_count <= 3'd0;
                end else begin
                    bit_count <= bit_count + 1'b1;
                end
            end

            if (sck_fall) begin
                if (bit_count == 3'd0) begin
                    tx_shift <= status_byte(byte_count);
                end else begin
                    tx_shift <= {tx_shift[6:0], 1'b0};
                end
            end
        end
    end

    initial begin
        LEDG = 9'b000000000;
        LEDR = 18'b000000000000000000;
        HEX0 = 7'h00;
        HEX1 = 7'h00;
        HEX2 = 7'h00;
        HEX3 = 7'h00;
        HEX4 = 7'h00;
        HEX5 = 7'h00;
        HEX6 = 7'h00;
        HEX7 = 7'h00;
        lcd_msg = {
            8'h45, 8'h53, 8'h50, 8'h33, 8'h32, 8'h20, 8'h46, 8'h50,
            8'h47, 8'h41, 8'h20, 8'h53, 8'h50, 8'h49, 8'h20, 8'h20,
            8'h57, 8'h45, 8'h42, 8'h20, 8'h43, 8'h4F, 8'h4E, 8'h54,
            8'h52, 8'h4F, 8'h4C, 8'h20, 8'h20, 8'h20, 8'h20, 8'h20
        };
    end

endmodule

module esp32_web_lcd_marquee (
    input  wire        clk,
    input  wire [255:0] msg,
    output reg  [7:0]  LCD_DATA,
    output reg         LCD_EN,
    output reg         LCD_RS,
    output wire        LCD_RW,
    output wire        LCD_ON
);

    assign LCD_RW = 1'b0;
    assign LCD_ON = 1'b1;

    localparam INIT        = 2'd0;
    localparam SET_LINE    = 2'd1;
    localparam WRITE_CHAR  = 2'd2;
    localparam SCROLL_WAIT = 2'd3;

    reg [1:0]  state;
    reg [23:0] delay_count;
    reg [2:0]  init_step;
    reg [4:0]  char_index;
    reg [4:0]  scroll_offset;
    reg [25:0] scroll_timer;

    wire [4:0] msg_index = (char_index + scroll_offset) & 5'h1F;
    wire [7:0] msg_char = msg[((31 - msg_index) * 8) +: 8];

    always @(posedge clk) begin
        case (state)
            INIT: begin
                LCD_RS <= 1'b0;
                if (delay_count < 24'd1000000) begin
                    delay_count <= delay_count + 1'b1;
                    LCD_EN <= 1'b0;
                end else if (delay_count < 24'd1000100) begin
                    LCD_EN <= 1'b1;
                    case (init_step)
                        3'd0: LCD_DATA <= 8'h38;
                        3'd1: LCD_DATA <= 8'h0C;
                        3'd2: LCD_DATA <= 8'h01;
                        3'd3: LCD_DATA <= 8'h06;
                        default: LCD_DATA <= 8'h01;
                    endcase
                    delay_count <= delay_count + 1'b1;
                end else if (delay_count < 24'd1000200) begin
                    LCD_EN <= 1'b0;
                    delay_count <= delay_count + 1'b1;
                end else begin
                    delay_count <= 24'd0;
                    if (init_step < 3'd3) begin
                        init_step <= init_step + 1'b1;
                    end else begin
                        state <= SET_LINE;
                    end
                end
            end

            SET_LINE: begin
                LCD_RS <= 1'b0;
                if (delay_count < 24'd50000) begin
                    delay_count <= delay_count + 1'b1;
                    LCD_EN <= 1'b0;
                end else if (delay_count < 24'd50100) begin
                    LCD_DATA <= 8'h80;
                    LCD_EN <= 1'b1;
                    delay_count <= delay_count + 1'b1;
                end else if (delay_count < 24'd50200) begin
                    LCD_EN <= 1'b0;
                    delay_count <= delay_count + 1'b1;
                end else begin
                    delay_count <= 24'd0;
                    char_index <= 5'd0;
                    state <= WRITE_CHAR;
                end
            end

            WRITE_CHAR: begin
                LCD_RS <= 1'b1;
                if (delay_count < 24'd5000) begin
                    delay_count <= delay_count + 1'b1;
                    LCD_EN <= 1'b0;
                end else if (delay_count < 24'd5100) begin
                    LCD_DATA <= msg_char;
                    LCD_EN <= 1'b1;
                    delay_count <= delay_count + 1'b1;
                end else if (delay_count < 24'd5200) begin
                    LCD_EN <= 1'b0;
                    delay_count <= delay_count + 1'b1;
                end else begin
                    delay_count <= 24'd0;
                    if (char_index < 5'd15) begin
                        char_index <= char_index + 1'b1;
                    end else begin
                        state <= SCROLL_WAIT;
                    end
                end
            end

            SCROLL_WAIT: begin
                if (scroll_timer < 26'd20000000) begin
                    scroll_timer <= scroll_timer + 1'b1;
                end else begin
                    scroll_timer <= 26'd0;
                    scroll_offset <= scroll_offset + 1'b1;
                    state <= SET_LINE;
                end
            end

            default: begin
                state <= INIT;
            end
        endcase
    end

    initial begin
        state = INIT;
        delay_count = 24'd0;
        init_step = 3'd0;
        char_index = 5'd0;
        scroll_offset = 5'd0;
        scroll_timer = 26'd0;
        LCD_DATA = 8'h00;
        LCD_EN = 1'b0;
        LCD_RS = 1'b0;
    end

endmodule
