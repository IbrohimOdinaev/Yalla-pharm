using Yalla.Domain.Entities;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.UnitTests.Domain;

public class PrescriptionChecklistItemLookupTests
{
    [Fact]
    public void AttachLookupRequest_OnManualItem_Sets()
    {
        var item = PrescriptionChecklistItem.Manual("Eufillin 240mg", 1, null);
        var lookupId = Guid.NewGuid();

        item.AttachLookupRequest(lookupId);

        Assert.Equal(lookupId, item.LookupRequestId);
    }

    [Fact]
    public void AttachLookupRequest_OnCatalogItem_Throws()
    {
        var item = PrescriptionChecklistItem.FromCatalog(Guid.NewGuid(), 1, null);

        Assert.Throws<DomainException>(() => item.AttachLookupRequest(Guid.NewGuid()));
    }

    [Fact]
    public void AttachLookupRequest_EmptyId_Throws()
    {
        var item = PrescriptionChecklistItem.Manual("x", 1, null);

        Assert.Throws<DomainArgumentException>(() => item.AttachLookupRequest(Guid.Empty));
    }

    [Fact]
    public void DetachLookupRequest_ClearsId()
    {
        var item = PrescriptionChecklistItem.Manual("x", 1, null);
        item.AttachLookupRequest(Guid.NewGuid());

        item.DetachLookupRequest();

        Assert.Null(item.LookupRequestId);
    }
}
