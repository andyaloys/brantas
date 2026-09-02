namespace Brantas.Application.Data;

public interface IDataSourceConnector
{
    string SourceCode { get; }
    Task<IngestionResult> FetchAsync(IngestionRequest request, CancellationToken cancellationToken);
}

public sealed record IngestionRequest(string Period, int Seed);

public sealed record IngestionResult(string SourceCode, int RecordCount, string Checksum);