`timescale 1ns / 1ps

module lcd_marquee(
    input  wire        clk,       // 50 MHz
    input  wire [255:0] msg,      // 32 chars x 8 bit
    output reg  [7:0]   LCD_DATA,
    output reg          LCD_EN,
    output reg          LCD_RS,
    output wire         LCD_RW,
    output wire         LCD_ON
);

    assign LCD_RW = 1'b0; // Only write, no read
    assign LCD_ON = 1'b1; // Always ON LCD power

    // States
    localparam INIT        = 0;
    localparam IDLE        = 1;
    localparam WRITE_CHAR  = 2;
    localparam SCROLL_WAIT = 3;

    reg [3:0] state = INIT;
    reg [23:0] delay_cnt = 0;
    
    // HD44780 Init sequence:
    reg [2:0] init_step = 0;
    reg [4:0] char_idx = 0;
    reg [4:0] scroll_ofs = 0; // 0 to 31
    reg [25:0] scroll_timer = 0; // Speed of marquee ~0.3s -> 15M clocks

    always @(posedge clk) begin
        if (state == INIT) begin
            LCD_RS <= 0; // Command mode
            if (delay_cnt < 1000000) begin // 20ms startup wait
                delay_cnt <= delay_cnt + 1;
                LCD_EN <= 0;
            end else if (delay_cnt < 1000100) begin // 2us setup
                LCD_EN <= 1;
                case(init_step)
                    0: LCD_DATA <= 8'h38; // 8-bit, 2 lines, 5x8
                    1: LCD_DATA <= 8'h0C; // Display ON, cursor OFF
                    2: LCD_DATA <= 8'h01; // Clear display
                    3: LCD_DATA <= 8'h06; // Entry mode (increment)
                    default: LCD_DATA <= 8'h01;
                endcase
                delay_cnt <= delay_cnt + 1;
            end else if (delay_cnt < 1000200) begin // End strobe
                LCD_EN <= 0;
                delay_cnt <= delay_cnt + 1;
            end else begin
                delay_cnt <= 0;
                if (init_step < 3) init_step <= init_step + 1;
                else state <= IDLE;
            end
        end
        else if (state == IDLE) begin
            // Ready to draw line 1
            LCD_RS <= 0;
            if (delay_cnt < 50000) begin // Wait ~1ms
                delay_cnt <= delay_cnt + 1;
                LCD_EN <= 0;
            end else if (delay_cnt < 50100) begin
                LCD_EN <= 1;
                LCD_DATA <= 8'h80; // Set DDRAM 0 (START)
                delay_cnt <= delay_cnt + 1;
            end else if (delay_cnt < 50200) begin
                LCD_EN <= 0;
                delay_cnt <= delay_cnt + 1;
            end else begin
                delay_cnt <= 0;
                char_idx <= 0;
                state <= WRITE_CHAR;
            end
        end
        else if (state == WRITE_CHAR) begin
            LCD_RS <= 1; // Data mode
            if (delay_cnt < 5000) begin // Wait ~100us per char
                delay_cnt <= delay_cnt + 1;
                LCD_EN <= 0;
            end else if (delay_cnt < 5100) begin
                LCD_EN <= 1;
                // Tính toán kí tự vòng tròn hiện tại dựa trên scroll_ofs
                // (31 - idx) vì byte đầu tiên nằm ở Most Significant Bits [255:248]
                LCD_DATA <= msg[((31 - ((char_idx + scroll_ofs) % 32)) * 8) +: 8];
                delay_cnt <= delay_cnt + 1;
            end else if (delay_cnt < 5200) begin
                LCD_EN <= 0;
                delay_cnt <= delay_cnt + 1;
            end else begin
                delay_cnt <= 0;
                if (char_idx < 15) begin
                    char_idx <= char_idx + 1;
                end else begin
                    state <= SCROLL_WAIT;
                end
            end
        end
        else if (state == SCROLL_WAIT) begin
            if (scroll_timer < 20_000_000) begin // Tốc độ trượt (0.4s)
                scroll_timer <= scroll_timer + 1;
            end else begin
                scroll_timer <= 0;
                if (scroll_ofs < 31) scroll_ofs <= scroll_ofs + 1;
                else scroll_ofs <= 0;
                
                state <= IDLE; // Trigger next draw
            end
        end
    end
endmodule
