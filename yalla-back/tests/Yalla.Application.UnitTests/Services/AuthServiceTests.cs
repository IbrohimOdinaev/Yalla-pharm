using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;
using Yalla.Infrastructure.Security;

namespace Yalla.Application.UnitTests.Services;

public sealed class AuthServiceTests
{
  [Fact]
  public async Task LoginAsync_WithValidClientCredentials_ReturnsToken()
  {
    using var scope = TestDbFactory.Create();
    var hasher = new PasswordHasher();
    var passwordHash = hasher.HashPassword("Pass123!");
    var user = new User(Guid.NewGuid(), "Client", "992111001", passwordHash, Role.Client);
    scope.Db.Users.Add(user);
    await scope.Db.SaveChangesAsync();

    var jwt = new FakeJwtTokenProvider();
    var service = new AuthService(scope.Db, hasher, jwt);

    var response = await service.LoginAsync(new LoginRequest
    {
      PhoneNumber = " 992111001 ",
      Password = "Pass123!"
    });

    Assert.Equal(user.Id, response.UserId);
    Assert.Equal(Role.Client, response.Role);
    Assert.Equal("token", response.AccessToken);
    Assert.Null(jwt.LastPharmacyId);
  }

  [Fact]
  public async Task LoginAsync_WithInvalidPassword_Throws()
  {
    using var scope = TestDbFactory.Create();
    var hasher = new PasswordHasher();
    var passwordHash = hasher.HashPassword("Pass123!");
    scope.Db.Users.Add(new User(Guid.NewGuid(), "Client", "992111002", passwordHash, Role.Client));
    await scope.Db.SaveChangesAsync();

    var service = new AuthService(scope.Db, hasher, new FakeJwtTokenProvider());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.LoginAsync(new LoginRequest
    {
      PhoneNumber = "992111002",
      Password = "wrong"
    }));
  }

  [Fact]
  public async Task LoginAsync_AdminWithoutPharmacy_Throws()
  {
    using var scope = TestDbFactory.Create();
    var hasher = new PasswordHasher();
    var passwordHash = hasher.HashPassword("Pass123!");
    var admin = new User(Guid.NewGuid(), "Admin", "992111003", passwordHash, Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();

    var service = new AuthService(scope.Db, hasher, new FakeJwtTokenProvider());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.LoginAsync(new LoginRequest
    {
      PhoneNumber = "992111003",
      Password = "Pass123!"
    }));
  }

  [Fact]
  public async Task LoginAsync_AdminWithPharmacy_SetsPharmacyIdInToken()
  {
    using var scope = TestDbFactory.Create();
    var hasher = new PasswordHasher();
    var passwordHash = hasher.HashPassword("Pass123!");

    var adminId = Guid.NewGuid();
    var pharmacyId = Guid.NewGuid();
    var pharmacy = new Pharmacy(pharmacyId, "P", "Addr", adminId, true);
    var admin = new PharmacyWorker(
      adminId,
      "Admin",
      "992111004",
      passwordHash,
      pharmacyId,
      pharmacy,
      Role.Admin);

    scope.Db.Pharmacies.Add(pharmacy);
    scope.Db.PharmacyWorkers.Add(admin);
    await scope.Db.SaveChangesAsync();

    var jwt = new FakeJwtTokenProvider();
    var service = new AuthService(scope.Db, hasher, jwt);

    var response = await service.LoginAsync(new LoginRequest
    {
      PhoneNumber = "992111004",
      Password = "Pass123!"
    });

    Assert.Equal(Role.Admin, response.Role);
    Assert.Equal(pharmacyId, jwt.LastPharmacyId);
  }

  [Fact]
  public async Task ChangePasswordAsync_WithValidCurrentPassword_UpdatesHash()
  {
    using var scope = TestDbFactory.Create();
    var hasher = new PasswordHasher();
    var oldHash = hasher.HashPassword("OldPass123!");
    var user = new User(Guid.NewGuid(), "Client", "992111005", oldHash, Role.Client);
    scope.Db.Users.Add(user);
    await scope.Db.SaveChangesAsync();

    var service = new AuthService(scope.Db, hasher, new FakeJwtTokenProvider());

    var response = await service.ChangePasswordAsync(user.Id, new ChangePasswordRequest
    {
      CurrentPassword = "OldPass123!",
      NewPassword = "NewPass123!"
    });

    scope.Db.ChangeTracker.Clear();
    var savedUser = await scope.Db.Users.FindAsync(user.Id);

    Assert.True(response.IsChanged);
    Assert.NotNull(savedUser);
    Assert.NotEqual(oldHash, savedUser!.PasswordHash);
    Assert.True(hasher.VerifyPassword("NewPass123!", savedUser.PasswordHash));
  }

  [Fact]
  public async Task ChangePasswordAsync_WithInvalidCurrentPassword_Throws()
  {
    using var scope = TestDbFactory.Create();
    var hasher = new PasswordHasher();
    var oldHash = hasher.HashPassword("OldPass123!");
    var user = new User(Guid.NewGuid(), "Client", "992111006", oldHash, Role.Client);
    scope.Db.Users.Add(user);
    await scope.Db.SaveChangesAsync();

    var service = new AuthService(scope.Db, hasher, new FakeJwtTokenProvider());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.ChangePasswordAsync(user.Id, new ChangePasswordRequest
    {
      CurrentPassword = "WrongOld",
      NewPassword = "NewPass123!"
    }));
  }

  [Fact]
  public async Task UpdateAdminProfileAsync_WithValidData_UpdatesNameAndPhone()
  {
    using var scope = TestDbFactory.Create();
    var hasher = new PasswordHasher();
    var admin = new User(Guid.NewGuid(), "Old Admin", "992111007", hasher.HashPassword("Pass123!"), Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();

    var service = new AuthService(scope.Db, hasher, new FakeJwtTokenProvider());

    var response = await service.UpdateAdminProfileAsync(admin.Id, new UpdateAdminProfileRequest
    {
      Name = "New Admin",
      PhoneNumber = " 992111008 "
    });

    Assert.Equal("New Admin", response.Name);
    Assert.Equal("992111008", response.PhoneNumber);
  }

  [Fact]
  public async Task UpdateAdminProfileAsync_WithTakenPhone_Throws()
  {
    using var scope = TestDbFactory.Create();
    var hasher = new PasswordHasher();
    var admin = new User(Guid.NewGuid(), "Admin", "992111009", hasher.HashPassword("Pass123!"), Role.Admin);
    var other = new User(Guid.NewGuid(), "Other", "992111010", hasher.HashPassword("Pass123!"), Role.Client);
    scope.Db.Users.AddRange(admin, other);
    await scope.Db.SaveChangesAsync();

    var service = new AuthService(scope.Db, hasher, new FakeJwtTokenProvider());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.UpdateAdminProfileAsync(admin.Id, new UpdateAdminProfileRequest
    {
      Name = "Admin Updated",
      PhoneNumber = "992111010"
    }));
  }

  [Fact]
  public async Task UpdateAdminProfileAsync_WithNonAdminRole_Throws()
  {
    using var scope = TestDbFactory.Create();
    var hasher = new PasswordHasher();
    var clientUser = new User(Guid.NewGuid(), "Client", "992111011", hasher.HashPassword("Pass123!"), Role.Client);
    scope.Db.Users.Add(clientUser);
    await scope.Db.SaveChangesAsync();

    var service = new AuthService(scope.Db, hasher, new FakeJwtTokenProvider());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.UpdateAdminProfileAsync(clientUser.Id, new UpdateAdminProfileRequest
    {
      Name = "Client",
      PhoneNumber = "992111011"
    }));
  }

  [Fact]
  public async Task UpdateAdminProfileAsync_WithEmptyAdminId_ThrowsDomainArgument()
  {
    using var scope = TestDbFactory.Create();
    var service = new AuthService(scope.Db, new PasswordHasher(), new FakeJwtTokenProvider());

    await Assert.ThrowsAsync<DomainArgumentException>(() => service.UpdateAdminProfileAsync(Guid.Empty, new UpdateAdminProfileRequest
    {
      Name = "Admin",
      PhoneNumber = "992111012"
    }));
  }

  private sealed class FakeJwtTokenProvider : IJwtTokenProvider
  {
    public Guid? LastPharmacyId { get; private set; }

    public (string AccessToken, DateTime ExpiresAtUtc) GenerateToken(
      Guid userId,
      string name,
      string phoneNumber,
      Role role,
      Guid? pharmacyId = null)
    {
      LastPharmacyId = pharmacyId;
      return ("token", DateTime.UtcNow.AddHours(1));
    }
  }
}
