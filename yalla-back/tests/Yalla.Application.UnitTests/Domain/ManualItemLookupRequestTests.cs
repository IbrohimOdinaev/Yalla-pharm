using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.UnitTests.Domain;

public class ManualItemLookupRequestTests
{
    private static ManualItemLookupRequest MakeRequest() =>
      new(
        prescriptionId: Guid.NewGuid(),
        checklistItemId: Guid.NewGuid(),
        requestedByPharmacistId: Guid.NewGuid(),
        manualMedicineName: "Eufillin 240mg",
        requestComment: "ампулы 10 мл, не таблетки");

    [Fact]
    public void Constructor_ValidData_StartsOpen()
    {
        var request = MakeRequest();

        Assert.Equal(ManualItemLookupRequestStatus.Open, request.Status);
        Assert.Empty(request.Responses);
        Assert.Null(request.ClosedAtUtc);
        Assert.NotEqual(default, request.CreatedAtUtc);
    }

    [Fact]
    public void Constructor_EmptyPrescriptionId_Throws()
    {
        Assert.Throws<DomainArgumentException>(() => new ManualItemLookupRequest(
          prescriptionId: Guid.Empty,
          checklistItemId: Guid.NewGuid(),
          requestedByPharmacistId: Guid.NewGuid(),
          manualMedicineName: "x",
          requestComment: null));
    }

    [Fact]
    public void Constructor_BlankMedicineName_Throws()
    {
        Assert.Throws<DomainArgumentException>(() => new ManualItemLookupRequest(
          prescriptionId: Guid.NewGuid(),
          checklistItemId: Guid.NewGuid(),
          requestedByPharmacistId: Guid.NewGuid(),
          manualMedicineName: "  ",
          requestComment: null));
    }

    [Fact]
    public void AddOrUpdateResponse_NewPharmacy_AddsRow()
    {
        var request = MakeRequest();
        var pharmacyId = Guid.NewGuid();
        var adminId = Guid.NewGuid();

        var response = request.AddOrUpdateResponse(
          pharmacyId, adminId, "Eufillin 240mg amp", 12.50m, 5, imageKey: null, responseComment: null);

        Assert.Single(request.Responses);
        Assert.Equal(pharmacyId, response.RespondingPharmacyId);
        Assert.Equal(5, response.Quantity);
        Assert.Equal(12.50m, response.Price);
    }

    [Fact]
    public void AddOrUpdateResponse_SamePharmacyTwice_UpdatesInPlace()
    {
        var request = MakeRequest();
        var pharmacyId = Guid.NewGuid();
        var adminId = Guid.NewGuid();

        var first = request.AddOrUpdateResponse(
          pharmacyId, adminId, "Old name", 10m, 3, imageKey: null, responseComment: null);
        var second = request.AddOrUpdateResponse(
          pharmacyId, adminId, "New name", 12m, 7, imageKey: "key.png", responseComment: "found");

        Assert.Single(request.Responses);
        Assert.Same(first, second);
        Assert.Equal("New name", second.FullName);
        Assert.Equal(12m, second.Price);
        Assert.Equal(7, second.Quantity);
        Assert.Equal("key.png", second.ImageKey);
        Assert.Equal("found", second.ResponseComment);
    }

    [Fact]
    public void AddOrUpdateResponse_AfterClose_Throws()
    {
        var request = MakeRequest();
        request.Close();

        Assert.Throws<DomainException>(() => request.AddOrUpdateResponse(
          Guid.NewGuid(), Guid.NewGuid(), "x", 1m, 1, null, null));
    }

    [Fact]
    public void AddOrUpdateResponse_ZeroPrice_Throws()
    {
        var request = MakeRequest();

        Assert.Throws<DomainArgumentException>(() => request.AddOrUpdateResponse(
          Guid.NewGuid(), Guid.NewGuid(), "x", 0m, 1, null, null));
    }

    [Fact]
    public void Close_Idempotent()
    {
        var request = MakeRequest();
        request.Close();
        var firstClosedAt = request.ClosedAtUtc;

        request.Close();

        Assert.Equal(ManualItemLookupRequestStatus.Closed, request.Status);
        Assert.Equal(firstClosedAt, request.ClosedAtUtc);
    }
}
