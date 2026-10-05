namespace Brantas.Application.Assistant;

public sealed record ChatHistoryItem(string Role, string Content);

public interface IBrantasAssistant
{
    Task<AssistantResponse> AskAsync(string question, CancellationToken cancellationToken)
        => AskAsync(question, null, cancellationToken);

    Task<AssistantResponse> AskAsync(string question, IReadOnlyList<ChatHistoryItem>? history, CancellationToken cancellationToken);
}

public sealed record AssistantResponse(string Answer, string Source, string DatasetVersionId, string Period, bool UsedFallback);