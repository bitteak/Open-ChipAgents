`default_nettype none

module gcd (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        start,
    input  wire [15:0] a,
    input  wire [15:0] b,
    output reg  [15:0] result,
    output reg         done
);
    reg [15:0] x;
    reg [15:0] y;
    reg        busy;

    always @(posedge clk) begin
        if (!rst_n) begin
            x      <= 16'd0;
            y      <= 16'd0;
            result <= 16'd0;
            done   <= 1'b0;
            busy   <= 1'b0;
        end else begin
            done <= 1'b0;
            if (start && !busy) begin
                x    <= a;
                y    <= b;
                busy <= 1'b1;
            end else if (busy) begin
                if (y == 16'd0) begin
                    result <= x;
                    done   <= 1'b1;
                    busy   <= 1'b0;
                end else if (x > y) begin
                    x <= x - y;
                end else begin
                    y <= y - x;
                end
            end
        end
    end
endmodule

`default_nettype wire
