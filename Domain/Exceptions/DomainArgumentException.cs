using System.Runtime.CompilerServices;

namespace Yalla.Domain.Exceptions;

public class DomainArgumentException : DomainException
{
  public DomainArgumentException(
    string message,
    [CallerMemberName] string memberName = "",
    [CallerFilePath] string filePath = "",
    [CallerLineNumber] int lineNumber = 0)
    : base($"{message} (Member: {memberName}; File: {Path.GetFileName(filePath)}; Line: {lineNumber})")
  { }
}
