namespace Brantas.Application.Assistant;

public interface IBrantasAssistant
{
    Task<AssistantResponse> AskAsync(string question, CancellationToken cancellationToken);
}

public sealed record AssistantResponse(string Answer, string Source, string DatasetVersionId, string Period, bool UsedFallback);