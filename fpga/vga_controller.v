// ==========================================================================
// VGA Controller 640x480 @ 60Hz - SUPER SAFE VERSION
// ==========================================================================
module vga_controller (
    input  wire       clk_25m,
    input  wire       rst_n,
    output reg        o_hs,
    output reg        o_vs,
    output reg        o_blank_n,
    output wire       o_sync_n,
    output wire [9:0] o_x,
    output wire [9:0] o_y,
    output reg        o_active
);

    // Timing chuẩn 640x480 @ 60Hz
    localparam H_DISP = 640, H_FP = 16, H_SYNC = 96, H_BP = 48, H_TOTAL = 800;
    localparam V_DISP = 480, V_FP = 10, V_SYNC = 2,  V_BP = 33, V_TOTAL = 525;

    reg [9:0] h_cnt, v_cnt;

    // Bộ đếm quét màn hình
    always @(posedge clk_25m or negedge rst_n) begin
        if (!rst_n) begin
            h_cnt <= 0; v_cnt <= 0;
        end else begin
            if (h_cnt == H_TOTAL - 1) begin
                h_cnt <= 0;
                if (v_cnt == V_TOTAL - 1) v_cnt <= 0;
                else v_cnt <= v_cnt + 1'b1;
            end else h_cnt <= h_cnt + 1'b1;
        end
    end

    // Xuất tọa độ (không qua register để giảm delay 1 clock)
    assign o_x = (h_cnt < H_DISP) ? h_cnt : 10'd0;
    assign o_y = (v_cnt < V_DISP) ? v_cnt : 10'd0;

    // Tín hiệu đồng bộ và Blank (Register để timing ổn định)
    always @(posedge clk_25m or negedge rst_n) begin
        if (!rst_n) begin
            o_hs      <= 1'b1;
            o_vs      <= 1'b1;
            o_blank_n <= 1'b0;
            o_active  <= 1'b0;
        end else begin
            o_hs      <= ~((h_cnt >= (H_DISP + H_FP)) && (h_cnt < (H_DISP + H_FP + H_SYNC)));
            o_vs      <= ~((v_cnt >= (V_DISP + V_FP)) && (v_cnt < (V_DISP + V_FP + V_SYNC)));
            o_active  <= (h_cnt < H_DISP) && (v_cnt < V_DISP);
            o_blank_n <= (h_cnt < H_DISP) && (v_cnt < V_DISP);
        end
    end

    // QUAN TRỌNG: Với DE2i-150, SYNC_N nên để bằng 1
    assign o_sync_n = 1'b1; 

endmodule
