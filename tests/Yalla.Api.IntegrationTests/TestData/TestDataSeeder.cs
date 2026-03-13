using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Infrastructure;
using PaymentMethodEntity = Yalla.Domain.Entities.PaymentMethod;

namespace Yalla.Api.IntegrationTests.TestData;

public static class TestDataSeeder
{
    public static async Task SeedAsync(YallaDbContext dbContext)
    {
        PaymentMethodEntity paymentMethod = new();
        paymentMethod.SetName("Cash");

        dbContext.PaymentMethods.Add(paymentMethod);
        dbContext.Entry(paymentMethod).Property(nameof(PaymentMethodEntity.Id)).CurrentValue = TestGuids.SeedPaymentMethodId;

        User adminUser = new();
        adminUser.SetId(TestGuids.SeedAdminUserId);
        adminUser.SetFirstName("Seed");
        adminUser.SetLastName("Admin");
        adminUser.SetPhoneNumber("+992900000999");
        adminUser.SetRole(UserRole.Administrator);
        adminUser.SetEmail("admin.integration@yalla.test");
        adminUser.SetPassword("Password123!");

        dbContext.Users.Add(adminUser);

        await dbContext.SaveChangesAsync();
    }
}
