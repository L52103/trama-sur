using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Store.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OperationalSecurityHardening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "mfa_verified",
                table: "refresh_tokens",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "source_cart_id",
                table: "orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "media_assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    storage_key = table.Column<string>(type: "text", nullable: false),
                    public_url = table.Column<string>(type: "text", nullable: false),
                    content_type = table.Column<string>(type: "text", nullable: false),
                    size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    checksum_sha256 = table.Column<string>(type: "text", nullable: false),
                    alt_text = table.Column<string>(type: "text", nullable: false),
                    uploaded_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("p_k_media_assets", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "i_x_orders_source_cart_id",
                table: "orders",
                column: "source_cart_id");

            migrationBuilder.CreateIndex(
                name: "i_x_media_assets_checksum_sha256",
                table: "media_assets",
                column: "checksum_sha256");

            migrationBuilder.CreateIndex(
                name: "i_x_media_assets_is_deleted_created_at",
                table: "media_assets",
                columns: new[] { "is_deleted", "created_at" });

            migrationBuilder.CreateIndex(
                name: "i_x_media_assets_storage_key",
                table: "media_assets",
                column: "storage_key",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "media_assets");

            migrationBuilder.DropIndex(
                name: "i_x_orders_source_cart_id",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "mfa_verified",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "source_cart_id",
                table: "orders");
        }
    }
}
