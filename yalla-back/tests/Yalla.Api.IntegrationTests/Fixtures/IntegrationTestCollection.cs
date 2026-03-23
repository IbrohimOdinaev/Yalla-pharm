namespace Yalla.Api.IntegrationTests.Fixtures;

[CollectionDefinition(Name)]
public sealed class IntegrationTestCollection : ICollectionFixture<IntegrationTestFixture>
{
    public const string Name = "yalla-api-integration";
}
