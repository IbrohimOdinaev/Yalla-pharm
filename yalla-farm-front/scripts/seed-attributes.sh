#!/bin/bash
# Seed medicine attributes via API
# Usage: ./scripts/seed-attributes.sh <superadmin-token>

TOKEN="$1"
API="http://localhost:5000"

# Get medicines
MEDICINES=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/api/medicines/all?page=1&pageSize=50")

# For each medicine, update with relevant attributes
# Example attributes for common medicines:
# Парацетамол: dosage=500mg, form=Таблетки
# Цитрамон: dosage=240mg, form=Таблетки
# Аспирин: dosage=100mg, form=Таблетки

echo "To add attributes, use the SuperAdmin medicines tab in the UI."
echo "Attributes are added when creating a medicine: dosage:500mg, form:Таблетки"
