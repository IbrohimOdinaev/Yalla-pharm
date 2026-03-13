using Microsoft.AspNetCore.Mvc;
namespace Yalla.Presentation.Tests.Controllers;

public sealed class UserApiControllerTests
{
    [Fact]
    public async Task CreateUserAsync_WhenServiceReturnsTrue_ShouldReturnOk()
    {
        Mock<IUserService> serviceMock = new();
        UserResponse user = new();
        serviceMock.Setup(x => x.CreateAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        UserApiController controller = new(serviceMock.Object);

        IActionResult result = await controller.CreateUserAsync(user);

        Assert.IsType<OkResult>(result);
        serviceMock.Verify(x => x.CreateAsync(user, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateUserAsync_WhenServiceReturnsFalse_ShouldReturnBadRequest()
    {
        Mock<IUserService> serviceMock = new();
        UserResponse user = new();
        serviceMock.Setup(x => x.CreateAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync(false);
        UserApiController controller = new(serviceMock.Object);

        IActionResult result = await controller.CreateUserAsync(user);

        Assert.IsType<BadRequestResult>(result);
    }

    [Fact]
    public async Task UpdateUserAsync_WhenServiceReturnsTrue_ShouldReturnOk()
    {
        Mock<IUserService> serviceMock = new();
        UserResponse user = new();
        serviceMock.Setup(x => x.UpdateAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        UserApiController controller = new(serviceMock.Object);

        IActionResult result = await controller.UpdateUserAsync(user);

        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task UpdateUserAsync_WhenServiceReturnsFalse_ShouldReturnNotFound()
    {
        Mock<IUserService> serviceMock = new();
        UserResponse user = new();
        serviceMock.Setup(x => x.UpdateAsync(user, It.IsAny<CancellationToken>())).ReturnsAsync(false);
        UserApiController controller = new(serviceMock.Object);

        IActionResult result = await controller.UpdateUserAsync(user);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task DeleteUserAsync_WhenServiceReturnsTrue_ShouldReturnOk()
    {
        Mock<IUserService> serviceMock = new();
        serviceMock.Setup(x => x.DeleteAsync(TestIds.Id("user-1"), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        UserApiController controller = new(serviceMock.Object);

        IActionResult result = await controller.DeleteUserAsync(TestIds.Id("user-1"));

        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task DeleteUserAsync_WhenServiceReturnsFalse_ShouldReturnNotFound()
    {
        Mock<IUserService> serviceMock = new();
        serviceMock.Setup(x => x.DeleteAsync(TestIds.Id("user-1"), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        UserApiController controller = new(serviceMock.Object);

        IActionResult result = await controller.DeleteUserAsync(TestIds.Id("user-1"));

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetUserAsync_WhenUserFound_ShouldReturnOkWithUser()
    {
        Mock<IUserService> serviceMock = new();
        serviceMock.Setup(x => x.GetAsync(TestIds.Id("user-1"), It.IsAny<CancellationToken>())).ReturnsAsync(new UserResponse { Id = TestIds.Id("user-1") });
        UserApiController controller = new(serviceMock.Object);

        IActionResult result = await controller.GetUserAsync(TestIds.Id("user-1"));

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        UserResponse user = Assert.IsType<UserResponse>(ok.Value);
        Assert.Equal(TestIds.Id("user-1"), user.Id);
    }

    [Fact]
    public async Task GetUserAsync_WhenUserNotFound_ShouldReturnNotFound()
    {
        Mock<IUserService> serviceMock = new();
        serviceMock.Setup(x => x.GetAsync(TestIds.Id("user-1"), It.IsAny<CancellationToken>())).ReturnsAsync((UserResponse?)null);
        UserApiController controller = new(serviceMock.Object);

        IActionResult result = await controller.GetUserAsync(TestIds.Id("user-1"));

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetUsersAsync_WhenRepositoryReturnsEmpty_ShouldReturnNoContent()
    {
        Mock<IUserService> serviceMock = new();
        serviceMock
            .Setup(x => x.GetAsync(It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(Array.Empty<UserResponse>()));

        UserApiController controller = new(serviceMock.Object);

        IActionResult result = await controller.GetUsersAsync();

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task GetUsersAsync_WhenRepositoryReturnsUsers_ShouldReturnOkWithList()
    {
        Mock<IUserService> serviceMock = new();
        serviceMock
            .Setup(x => x.GetAsync(It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(new[] { new UserResponse { Email = "u@yalla.test" } }));

        UserApiController controller = new(serviceMock.Object);

        IActionResult result = await controller.GetUsersAsync();

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        List<UserResponse> users = Assert.IsType<List<UserResponse>>(ok.Value);
        Assert.Single(users);
    }
}
