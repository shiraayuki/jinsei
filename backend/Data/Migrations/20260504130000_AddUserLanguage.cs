using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

public partial class AddUserLanguage : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "language",
            table: "AspNetUsers",
            type: "text",
            nullable: false,
            defaultValue: "en");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "language",
            table: "AspNetUsers");
    }
}
