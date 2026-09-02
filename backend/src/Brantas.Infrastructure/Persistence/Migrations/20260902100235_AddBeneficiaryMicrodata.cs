using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Brantas.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBeneficiaryMicrodata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "beneficiary_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RegionId = table.Column<Guid>(type: "uuid", nullable: false),
                    DatasetVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    NikHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    NkkHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Program = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Decile = table.Column<int>(type: "integer", nullable: false),
                    IsActivePublicServant = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeceased = table.Column<bool>(type: "boolean", nullable: false),
                    HasEconomicAsset = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_beneficiary_records", x => x.Id);
                    table.ForeignKey(
                        name: "FK_beneficiary_records_dataset_versions_DatasetVersionId",
                        column: x => x.DatasetVersionId,
                        principalTable: "dataset_versions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_beneficiary_records_regions_RegionId",
                        column: x => x.RegionId,
                        principalTable: "regions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "welfare_coverages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RegionId = table.Column<Guid>(type: "uuid", nullable: false),
                    DatasetVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    EstimatedEligibleHouseholds = table.Column<int>(type: "integer", nullable: false),
                    RegisteredBeneficiaries = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_welfare_coverages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_welfare_coverages_dataset_versions_DatasetVersionId",
                        column: x => x.DatasetVersionId,
                        principalTable: "dataset_versions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_welfare_coverages_regions_RegionId",
                        column: x => x.RegionId,
                        principalTable: "regions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_beneficiary_records_DatasetVersionId_NikHash",
                table: "beneficiary_records",
                columns: new[] { "DatasetVersionId", "NikHash" });

            migrationBuilder.CreateIndex(
                name: "IX_beneficiary_records_DatasetVersionId_RegionId",
                table: "beneficiary_records",
                columns: new[] { "DatasetVersionId", "RegionId" });

            migrationBuilder.CreateIndex(
                name: "IX_beneficiary_records_RegionId",
                table: "beneficiary_records",
                column: "RegionId");

            migrationBuilder.CreateIndex(
                name: "IX_welfare_coverages_DatasetVersionId",
                table: "welfare_coverages",
                column: "DatasetVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_welfare_coverages_RegionId_DatasetVersionId",
                table: "welfare_coverages",
                columns: new[] { "RegionId", "DatasetVersionId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "beneficiary_records");

            migrationBuilder.DropTable(
                name: "welfare_coverages");
        }
    }
}
