namespace Yalla.Api.IntegrationTests.Fixtures;

public static class JwtTokenFactory
{
    private const string Issuer = "YallaBack";
    private const string Audience = "YallaFront";
    private const string Key = "my_megasuperultramaxipixelcombo_key";

    public static string CreateToken(params string[] roles)
    {
        List<Claim> claims =
        [
            new Claim(ClaimTypes.Name, "integration-user")
        ];

        foreach (string role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        SecurityKey signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key));

        JwtSecurityToken token = new(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
