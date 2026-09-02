using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Brantas.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAnomalyReviews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "anomaly_reviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AnomalyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_anomaly_reviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_anomaly_reviews_anomalies_AnomalyId",
                        column: x => x.AnomalyId,
                        principalTable: "anomalies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_anomaly_reviews_AnomalyId",
                table: "anomaly_reviews",
                column: "AnomalyId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "anomaly_reviews");
        }
    }
}
