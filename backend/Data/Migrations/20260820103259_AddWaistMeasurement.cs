using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWaistMeasurement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_weight_entries_user_id",
                table: "weight_entries");

            migrationBuilder.AlterColumn<decimal>(
                name: "weight_kg",
                table: "weight_entries",
                type: "numeric",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AddColumn<decimal>(
                name: "waist_cm",
                table: "weight_entries",
                type: "numeric",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_weight_entries_user_id_date",
                table: "weight_entries",
                columns: new[] { "user_id", "date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_weight_entries_user_id_date",
                table: "weight_entries");

            migrationBuilder.DropColumn(
                name: "waist_cm",
                table: "weight_entries");

            migrationBuilder.AlterColumn<decimal>(
                name: "weight_kg",
                table: "weight_entries",
                type: "numeric",
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_weight_entries_user_id",
                table: "weight_entries",
                column: "user_id");
        }
    }
}
