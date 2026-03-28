using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;

namespace Api.Controllers;

[ApiController]
[Route("api/categories")]
public sealed class CategoriesController : ControllerBase
{
    private readonly IAppDbContext _dbContext;

    public CategoriesController(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var categories = await _dbContext.Categories
          .AsNoTracking()
          .Where(x => x.IsActive)
          .OrderBy(x => x.Name)
          .ToListAsync(cancellationToken);

        var lookup = categories.ToLookup(c => c.ParentId);

        CategoryResponse Map(Category c) => new()
        {
            Id = c.Id,
            Name = c.Name,
            Slug = c.Slug,
            ParentId = c.ParentId,
            Type = c.Type?.ToString(),
            WooCommerceId = c.WooCommerceId,
            IsActive = c.IsActive,
            Children = lookup[c.Id]
              .OrderBy(ch => ch.Name)
              .Select(Map)
              .ToList()
        };

        var tree = categories
          .Where(c => c.ParentId == null)
          .OrderBy(c => c.Name)
          .Select(Map)
          .ToList();

        return Ok(new { categories = tree });
    }
}
