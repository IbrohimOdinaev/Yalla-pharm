namespace Yalla.Domain.Entities;

public class DeliveryData
{
  public Guid Id { get; private set; }

  public Guid OrderId { get; private set; }

  public Order Order { get; private set; } = null!;

  // From address (pharmacy)
  public long? FromAddressId { get; private set; }
  public string FromTitle { get; private set; } = string.Empty;
  public string FromAddress { get; private set; } = string.Empty;
  public double FromLatitude { get; private set; }
  public double FromLongitude { get; private set; }

  // To address (client delivery destination)
  public long? ToAddressId { get; private set; }
  public string ToTitle { get; private set; } = string.Empty;
  public string ToAddress { get; private set; } = string.Empty;
  public double ToLatitude { get; private set; }
  public double ToLongitude { get; private set; }

  // Delivery cost
  public decimal DeliveryCost { get; private set; }
  public double? Distance { get; private set; }

  // JURA order data
  public long? JuraOrderId { get; private set; }
  public string? JuraStatus { get; private set; }
  public int? JuraStatusId { get; private set; }
  public long? DriverDeviceId { get; private set; }
  public string? DriverName { get; private set; }
  public string? DriverPhone { get; private set; }
  public string? RecipientCode { get; private set; }

  private DeliveryData() { }

  public DeliveryData(
    Guid orderId,
    string fromTitle,
    string fromAddress,
    double fromLatitude,
    double fromLongitude,
    string toTitle,
    string toAddress,
    double toLatitude,
    double toLongitude,
    long? fromAddressId = null,
    long? toAddressId = null)
  {
    Id = Guid.NewGuid();
    OrderId = orderId;
    FromAddressId = fromAddressId;
    FromTitle = fromTitle;
    FromAddress = fromAddress;
    FromLatitude = fromLatitude;
    FromLongitude = fromLongitude;
    ToAddressId = toAddressId;
    ToTitle = toTitle;
    ToAddress = toAddress;
    ToLatitude = toLatitude;
    ToLongitude = toLongitude;
  }

  public void SetDeliveryCost(decimal cost, double? distance)
  {
    DeliveryCost = cost;
    Distance = distance;
  }

  public void SetJuraOrder(long juraOrderId, string? status, int? statusId)
  {
    JuraOrderId = juraOrderId;
    JuraStatus = status;
    JuraStatusId = statusId;
  }

  public void UpdateJuraStatus(string? status, int? statusId)
  {
    JuraStatus = status;
    JuraStatusId = statusId;
  }

  public void SetDriverInfo(long? deviceId, string? name, string? phone)
  {
    DriverDeviceId = deviceId;
    DriverName = name;
    DriverPhone = phone;
  }

  public void SetRecipientCode(string? code)
  {
    RecipientCode = string.IsNullOrWhiteSpace(code) ? null : code.Trim();
  }

  public void ClearJuraDispatch()
  {
    JuraOrderId = null;
    JuraStatus = null;
    JuraStatusId = null;
    DriverDeviceId = null;
    DriverName = null;
    DriverPhone = null;
    RecipientCode = null;
  }
}
