using System.Collections;
using System.Reflection;

namespace Yalla.BusinessLogic.Tests.TestInfrastructure;

internal static class TestEntityFactory
{
    public static T Create<T>(params (string Name, object? Value)[] values)
        where T : class, new()
    {
        T instance = new();
        return Mutate(instance, values);
    }

    public static T Mutate<T>(T instance, params (string Name, object? Value)[] values)
        where T : class
    {
        foreach ((string name, object? value) in values)
            Set(instance, name, value);

        return instance;
    }

    private static void Set(object target, string propertyName, object? value)
    {
        Type targetType = target.GetType();
        PropertyInfo? property = targetType.GetProperty(propertyName, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        if (property is not null)
        {
            object? converted = ConvertValue(value, property.PropertyType);

            if (property.SetMethod is not null)
            {
                property.SetValue(target, converted);
                return;
            }

            if (TrySetAutoBackingField(target, targetType, propertyName, converted))
                return;

            if (TryPopulateCollectionField(target, targetType, propertyName, converted))
                return;
        }

        if (TrySetNamedField(target, targetType, propertyName, value))
            return;

        throw new InvalidOperationException($"Cannot set '{propertyName}' on '{targetType.Name}'.");
    }

    private static bool TrySetAutoBackingField(object target, Type targetType, string propertyName, object? value)
    {
        FieldInfo? backingField = targetType.GetField($"<{propertyName}>k__BackingField",
            BindingFlags.Instance | BindingFlags.NonPublic);
        if (backingField is null)
            return false;

        object? converted = ConvertValue(value, backingField.FieldType);
        backingField.SetValue(target, converted);
        return true;
    }

    private static bool TryPopulateCollectionField(object target, Type targetType, string propertyName, object? value)
    {
        string fieldName = "_" + char.ToLowerInvariant(propertyName[0]) + propertyName[1..];
        FieldInfo? field = targetType.GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
        if (field is null || field.GetValue(target) is not IList list)
            return false;

        list.Clear();
        if (value is null)
            return true;

        if (value is IEnumerable enumerable and not string)
        {
            Type? elementType = field.FieldType.IsGenericType
                ? field.FieldType.GetGenericArguments()[0]
                : null;

            foreach (object? item in enumerable)
                list.Add(elementType is null ? item : ConvertValue(item, elementType));
            return true;
        }

        list.Add(value);
        return true;
    }

    private static bool TrySetNamedField(object target, Type targetType, string propertyName, object? value)
    {
        string[] candidates =
        {
            "_" + char.ToLowerInvariant(propertyName[0]) + propertyName[1..],
            propertyName
        };

        foreach (string candidate in candidates)
        {
            FieldInfo? field = targetType.GetField(candidate, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            if (field is null)
                continue;

            object? converted = ConvertValue(value, field.FieldType);
            field.SetValue(target, converted);
            return true;
        }

        return false;
    }

    private static object? ConvertValue(object? value, Type targetType)
    {
        if (value is null)
            return null;

        Type actualTargetType = Nullable.GetUnderlyingType(targetType) ?? targetType;

        if (actualTargetType == typeof(Guid))
        {
            if (value is Guid guidValue)
                return guidValue;

            if (value is string rawGuid)
                return TestIds.Id(rawGuid);
        }

        if (actualTargetType == typeof(string))
            return value.ToString();

        if (actualTargetType == typeof(DateTime) && value is string rawDate)
            return DateTime.Parse(rawDate);

        if (actualTargetType.IsEnum)
        {
            if (value.GetType().IsEnum)
                return Enum.Parse(actualTargetType, value.ToString()!, ignoreCase: true);

            if (value is string rawEnum)
                return Enum.Parse(actualTargetType, rawEnum, ignoreCase: true);
        }

        if (actualTargetType.IsAssignableFrom(value.GetType()))
            return value;

        return Convert.ChangeType(value, actualTargetType);
    }
}
