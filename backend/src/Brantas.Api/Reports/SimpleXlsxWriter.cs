using System.IO.Compression;
using System.Security;
using System.Text;

namespace Brantas.Api.Reports;

public static class SimpleXlsxWriter
{
    public static byte[] CreateWorkbook(string sheetName, string[] headers, IReadOnlyList<object?[]> rows)
    {
        using var memoryStream = new MemoryStream();
        using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
        {
            // 1. [Content_Types].xml
            AddEntry(archive, "[Content_Types].xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                </Types>
                """);

            // 2. _rels/.rels
            AddEntry(archive, "_rels/.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                </Relationships>
                """);

            // 3. xl/workbook.xml
            var cleanSheetName = EscapeXml(string.IsNullOrWhiteSpace(sheetName) ? "Sheet1" : sheetName);
            AddEntry(archive, "xl/workbook.xml", $"""
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <sheets>
                    <sheet name="{cleanSheetName}" sheetId="1" r:id="rId1"/>
                  </sheets>
                </workbook>
                """);

            // 4. xl/_rels/workbook.xml.rels
            AddEntry(archive, "xl/_rels/workbook.xml.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                </Relationships>
                """);

            // 5. xl/styles.xml (Header Teal #0D9488, Teks Putih Tebal, Format Nominal Lengkap Ribuan)
            AddEntry(archive, "xl/styles.xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <fonts count="2">
                    <font><name val="Calibri"/><sz val="11"/><color theme="1"/></font>
                    <font><b/><name val="Calibri"/><sz val="11"/><color rgb="FFFFFFFF"/></font>
                  </fonts>
                  <fills count="3">
                    <fill><patternFill patternType="none"/></fill>
                    <fill><patternFill patternType="gray125"/></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FF0D9488"/></patternFill></fill>
                  </fills>
                  <borders count="1">
                    <border><left/><right/><top/><bottom/><diagonal/></border>
                  </borders>
                  <cellStyleXfs count="1">
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
                  </cellStyleXfs>
                  <cellXfs count="3">
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
                    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
                    <xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
                  </cellXfs>
                </styleSheet>
                """);

            // 6. xl/worksheets/sheet1.xml
            var sheetXml = BuildSheetXml(headers, rows);
            AddEntry(archive, "xl/worksheets/sheet1.xml", sheetXml);
        }

        return memoryStream.ToArray();
    }

    private static void AddEntry(ZipArchive archive, string entryName, string content)
    {
        var entry = archive.CreateEntry(entryName, CompressionLevel.Fastest);
        using var stream = entry.Open();
        using var writer = new StreamWriter(stream, Encoding.UTF8);
        writer.Write(content.Trim());
    }

    private static string BuildSheetXml(string[] headers, IReadOnlyList<object?[]> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
        sb.AppendLine("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">");

        // Column widths
        sb.AppendLine("  <cols>");
        for (int i = 0; i < headers.Length; i++)
        {
            var colWidth = Math.Max(16, headers[i].Length + 4);
            if (headers[i].Contains("Uraian", StringComparison.OrdinalIgnoreCase))
            {
                colWidth = Math.Max(colWidth, 48);
            }
            sb.AppendLine($"    <col min=\"{i + 1}\" max=\"{i + 1}\" width=\"{colWidth}\" customWidth=\"1\"/>");
        }
        sb.AppendLine("  </cols>");

        sb.AppendLine("  <sheetData>");

        // Header Row (Row 1, Style 1 = Teal Bold White)
        sb.AppendLine("    <row r=\"1\">");
        for (int col = 0; col < headers.Length; col++)
        {
            var cellRef = GetCellRef(col, 1);
            var safeText = EscapeXml(headers[col]);
            sb.AppendLine($"      <c r=\"{cellRef}\" s=\"1\" t=\"inlineStr\"><is><t>{safeText}</t></is></c>");
        }
        sb.AppendLine("    </row>");

        // Data Rows (Row 2 .. N, Style 0 = Normal, Style 2 = Formatted Number #,##0)
        for (int r = 0; r < rows.Count; r++)
        {
            int rowIdx = r + 2;
            var rowData = rows[r];
            sb.AppendLine($"    <row r=\"{rowIdx}\">");

            for (int col = 0; col < headers.Length; col++)
            {
                var cellRef = GetCellRef(col, rowIdx);
                var val = col < rowData.Length ? rowData[col] : null;

                if (val is null)
                {
                    continue;
                }

                if (val is long or int or short or byte or ulong or uint or ushort or sbyte)
                {
                    var numStr = Convert.ToString(val, System.Globalization.CultureInfo.InvariantCulture);
                    sb.AppendLine($"      <c r=\"{cellRef}\" s=\"2\"><v>{numStr}</v></c>");
                }
                else if (val is decimal decVal && decVal == decimal.Truncate(decVal))
                {
                    var numStr = Convert.ToString(decVal, System.Globalization.CultureInfo.InvariantCulture);
                    sb.AppendLine($"      <c r=\"{cellRef}\" s=\"2\"><v>{numStr}</v></c>");
                }
                else if (IsNumeric(val))
                {
                    var numStr = Convert.ToString(val, System.Globalization.CultureInfo.InvariantCulture);
                    sb.AppendLine($"      <c r=\"{cellRef}\" s=\"0\"><v>{numStr}</v></c>");
                }
                else
                {
                    var safeStr = EscapeXml(val.ToString() ?? string.Empty);
                    sb.AppendLine($"      <c r=\"{cellRef}\" s=\"0\" t=\"inlineStr\"><is><t>{safeStr}</t></is></c>");
                }
            }

            sb.AppendLine("    </row>");
        }

        sb.AppendLine("  </sheetData>");
        sb.AppendLine("</worksheet>");
        return sb.ToString();
    }

    private static string GetCellRef(int colIndex, int rowIndex)
    {
        var colName = string.Empty;
        int dividend = colIndex + 1;
        while (dividend > 0)
        {
            int modulo = (dividend - 1) % 26;
            colName = Convert.ToChar(65 + modulo) + colName;
            dividend = (dividend - modulo) / 26;
        }
        return $"{colName}{rowIndex}";
    }

    private static bool IsNumeric(object value)
    {
        return value is sbyte or byte or short or ushort or int or uint or long or ulong or float or double or decimal;
    }

    private static string EscapeXml(string input)
    {
        return SecurityElement.Escape(input) ?? string.Empty;
    }
}
