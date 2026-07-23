using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Store.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PostgreSqlConcurrencyToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // xmin already exists as a PostgreSQL system column. Remove the former
            // application-owned xid and let EF use the server-generated value.
            migrationBuilder.DropColumn(
                name: "row_version",
                table: "inventory_items");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<uint>(
                name: "row_version",
                table: "inventory_items",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValueSql: "txid_current()::text::xid");
        }
    }
}
