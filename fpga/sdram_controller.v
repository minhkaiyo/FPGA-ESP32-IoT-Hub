// ==========================================================================
// SDRAM SIMPLE CONTROLLER FOR DE2i-150 (IS42S16320B)
// Giao tiếp 32-bit (Dùng cả 2 chip SDRAM song song)
// ==========================================================================
module sdram_test (
    input  wire        clk,        // SDRAM Clock (thường 100MHz)
    input  wire        rst_n,
    
    // Interface tới SDRAM Chip
    output reg         sdram_cke,
    output reg         sdram_cs_n,
    output reg         sdram_ras_n,
    output reg         sdram_cas_n,
    output reg         sdram_we_n,
    output reg  [12:0] sdram_addr,
    output reg  [1:0]  sdram_ba,
    output reg  [3:0]  sdram_dqm,
    inout  wire [31:0] sdram_dq,
    
    // Interface nội bộ FPGA
    input  wire        wr_en,
    input  wire [24:0] addr,
    input  wire [31:0] wr_data,
    output reg         busy
);

    // State Machine
    localparam ST_INIT_WAIT = 4'd0, ST_INIT_PRE = 4'd1, ST_INIT_REF = 4'd2, ST_INIT_LMR = 4'd3;
    localparam ST_IDLE      = 4'd4, ST_WRITE    = 4'd5, ST_READ     = 4'd6;
    reg [3:0] state;
    reg [15:0] timer;

    assign sdram_dq = (state == ST_WRITE) ? wr_data : 32'hZZZZZZZZ;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= ST_INIT_WAIT;
            timer <= 0;
            busy <= 1;
            sdram_cke <= 1;
        end else begin
            case (state)
                // 1. Đợi 200us (khởi động chip)
                ST_INIT_WAIT: begin
                    if (timer < 16'd20000) timer <= timer + 1'b1;
                    else begin state <= ST_INIT_PRE; timer <= 0; end
                end

                // 2. Precharge All
                ST_INIT_PRE: begin
                    {sdram_cs_n, sdram_ras_n, sdram_cas_n, sdram_we_n} <= 4'b0010; // PRECHARGE
                    sdram_addr[10] <= 1; // All banks
                    state <= ST_INIT_REF;
                end

                // 3. Auto Refresh (Cần 2 lần)
                ST_INIT_REF: begin
                    {sdram_cs_n, sdram_ras_n, sdram_cas_n, sdram_we_n} <= 4'b0001; // REFRESH
                    if (timer < 16'd10) timer <= timer + 1'b1;
                    else begin state <= ST_INIT_LMR; timer <= 0; end
                end

                // 4. Load Mode Register (Dài Burst=1, CAS=3)
                ST_INIT_LMR: begin
                    {sdram_cs_n, sdram_ras_n, sdram_cas_n, sdram_we_n} <= 4'b0000; // LMR
                    sdram_addr <= 13'h0030; // CAS Latency = 3
                    state <= ST_IDLE;
                    busy <= 0;
                end

                ST_IDLE: begin
                    {sdram_cs_n, sdram_ras_n, sdram_cas_n, sdram_we_n} <= 4'b0111; // NOP
                    if (wr_en) begin
                        state <= ST_WRITE;
                        busy <= 1;
                    end
                end

                ST_WRITE: begin
                    // Đơn giản hóa: Activate Row + Write trong 1 chu kỳ (chỉ để test)
                    {sdram_cs_n, sdram_ras_n, sdram_cas_n, sdram_we_n} <= 4'b0100; // WRITE
                    sdram_addr <= addr[12:0];
                    state <= ST_IDLE;
                    busy <= 0;
                end
                
                default: state <= ST_IDLE;
            endcase
        end
    end

endmodule
