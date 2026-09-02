using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Brantas.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAssistantAuditLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "assistant_audit_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DatasetVersionId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequestHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Outcome = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assistant_audit_logs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_assistant_audit_logs_dataset_versions_DatasetVersionId",
                        column: x => x.DatasetVersionId,
                        principalTable: "dataset_versions",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_assistant_audit_logs_DatasetVersionId",
                table: "assistant_audit_logs",
                column: "DatasetVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_assistant_audit_logs_OccurredAt",
                table: "assistant_audit_logs",
                column: "OccurredAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "assistant_audit_logs");
        }
    }
}
