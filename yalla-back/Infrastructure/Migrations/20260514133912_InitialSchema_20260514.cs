using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema_20260514 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "audit_log",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    occurred_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    actor_role = table.Column<int>(type: "integer", nullable: true),
                    actor_ip = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    entity_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    action = table.Column<int>(type: "integer", nullable: false),
                    summary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    payload = table.Column<string>(type: "jsonb", nullable: true),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_log", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    slug = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    parent_id = table.Column<Guid>(type: "uuid", nullable: true),
                    type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    woo_commerce_id = table.Column<int>(type: "integer", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categories", x => x.id);
                    table.ForeignKey(
                        name: "FK_categories_categories_parent_id",
                        column: x => x.parent_id,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "manual_item_lookup_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    prescription_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_by_pharmacist_id = table.Column<Guid>(type: "uuid", nullable: false),
                    manual_medicine_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    request_comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false),
                    closed_at_utc = table.Column<DateTime>(type: "timestamp", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_manual_item_lookup_requests", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "payment_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    dc_base_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_settings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "pending_refunds",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    prescription_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false),
                    processed_at_utc = table.Column<DateTime>(type: "timestamp", nullable: true),
                    processed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    super_admin_comment = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pending_refunds", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "pharmacies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    address = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    admin_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    latitude = table.Column<double>(type: "double precision", nullable: true),
                    longitude = table.Column<double>(type: "double precision", nullable: true),
                    IconUrl = table.Column<string>(type: "text", nullable: true),
                    banner_url = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    opens_at = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    closes_at = table.Column<TimeOnly>(type: "time without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pharmacies", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "prescriptions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_age = table.Column<int>(type: "integer", nullable: false),
                    client_comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    preference_tier = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    assigned_pharmacist_id = table.Column<Guid>(type: "uuid", nullable: true),
                    decoded_at_utc = table.Column<DateTime>(type: "timestamp", nullable: true),
                    pharmacist_overall_comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    payment_intent_id = table.Column<Guid>(type: "uuid", nullable: true),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp", nullable: true),
                    cancelled_at_utc = table.Column<DateTime>(type: "timestamp", nullable: true),
                    cancellation_reason = table.Column<int>(type: "integer", nullable: true),
                    decode_failed_by_pharmacist_id = table.Column<Guid>(type: "uuid", nullable: true),
                    decode_failed_at_utc = table.Column<DateTime>(type: "timestamp", nullable: true),
                    decode_failure_reason = table.Column<int>(type: "integer", nullable: true),
                    decode_failure_comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prescriptions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sms_outbox_messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status_snapshot = table.Column<int>(type: "integer", nullable: false),
                    message_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    provider = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    attempt_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    next_attempt_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    sent_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    state = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    txn_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    msg_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    last_error_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    last_error_message = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sms_outbox_messages", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sms_verification_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    purpose = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    code_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    payload_json = table.Column<string>(type: "text", nullable: true),
                    last_txn_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    last_msg_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    attempts_remaining = table.Column<int>(type: "integer", nullable: false),
                    resends_remaining = table.Column<int>(type: "integer", nullable: false),
                    expires_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    resend_available_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    verified_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    failure_reason = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sms_verification_sessions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sync_state",
                columns: table => new
                {
                    key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    value = table.Column<string>(type: "text", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sync_state", x => x.key);
                });

            migrationBuilder.CreateTable(
                name: "telegram_auth_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    nonce = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    initiating_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    telegram_user_id = table.Column<long>(type: "bigint", nullable: true),
                    telegram_username = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    telegram_first_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    telegram_last_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    confirmation_chat_id = table.Column<long>(type: "bigint", nullable: true),
                    confirmation_message_id = table.Column<int>(type: "integer", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    expires_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    consumed_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_telegram_auth_sessions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "telegram_outbox_messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    chat_id = table.Column<long>(type: "bigint", nullable: false),
                    status_snapshot = table.Column<int>(type: "integer", nullable: false),
                    message_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    message = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    attempt_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    next_attempt_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    sent_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    state = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    telegram_message_id = table.Column<long>(type: "bigint", nullable: true),
                    last_error_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    last_error_message = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_telegram_outbox_messages", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "medicines",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    articul = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    description = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    woo_commerce_id = table.Column<int>(type: "integer", nullable: true),
                    slug = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    id_1c = table.Column<Guid>(type: "uuid", nullable: true),
                    category_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_catalog_medicine = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    manual_lookup_request_id = table.Column<Guid>(type: "uuid", nullable: true),
                    manual_lookup_response_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_medicines", x => x.id);
                    table.ForeignKey(
                        name: "FK_medicines_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "manual_item_lookup_responses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    responding_pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    responding_admin_id = table.Column<Guid>(type: "uuid", nullable: false),
                    full_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    price = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    image_key = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    response_comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_manual_item_lookup_responses", x => x.id);
                    table.ForeignKey(
                        name: "FK_manual_item_lookup_responses_manual_item_lookup_requests_re~",
                        column: x => x.request_id,
                        principalTable: "manual_item_lookup_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    gender = table.Column<int>(type: "integer", nullable: true),
                    date_of_birth = table.Column<DateOnly>(type: "date", nullable: true),
                    telegram_id = table.Column<long>(type: "bigint", nullable: true),
                    telegram_username = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    deactivated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    deactivated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deactivation_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    user_type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    privacy_policy_version_accepted = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    privacy_policy_accepted_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    privacy_policy_accepted_from_ip = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    has_free_prescription_credit = table.Column<bool>(type: "boolean", nullable: true, defaultValue: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                    table.ForeignKey(
                        name: "FK_users_pharmacies_pharmacy_id",
                        column: x => x.pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "prescription_checklist_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    prescription_id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: true),
                    manual_medicine_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    pharmacist_comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    kind = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    analog_medicine_id = table.Column<Guid>(type: "uuid", nullable: true),
                    analog_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                    lookup_request_id = table.Column<Guid>(type: "uuid", nullable: true),
                    use_unit_mode = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    unit_count = table.Column<int>(type: "integer", nullable: true),
                    unit_total_price = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prescription_checklist_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_prescription_checklist_items_prescriptions_prescription_id",
                        column: x => x.prescription_id,
                        principalTable: "prescriptions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "prescription_images",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    prescription_id = table.Column<Guid>(type: "uuid", nullable: false),
                    key = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    order_index = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prescription_images", x => x.id);
                    table.ForeignKey(
                        name: "FK_prescription_images_prescriptions_prescription_id",
                        column: x => x.prescription_id,
                        principalTable: "prescriptions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "medicine_attributes",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    value = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_medicine_attributes", x => x.id);
                    table.ForeignKey(
                        name: "FK_medicine_attributes_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "medicine_images",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    key = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    is_main = table.Column<bool>(type: "boolean", nullable: false),
                    is_minimal = table.Column<bool>(type: "boolean", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_medicine_images", x => x.id);
                    table.ForeignKey(
                        name: "FK_medicine_images_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "offers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    stock_quantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_offers", x => x.id);
                    table.ForeignKey(
                        name: "FK_offers_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_offers_pharmacies_pharmacy_id",
                        column: x => x.pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "basket_positions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_basket_positions", x => x.id);
                    table.ForeignKey(
                        name: "FK_basket_positions_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_basket_positions_users_client_id",
                        column: x => x.client_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "client_addresses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    latitude = table.Column<double>(type: "double precision", nullable: false),
                    longitude = table.Column<double>(type: "double precision", nullable: false),
                    last_used_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_client_addresses", x => x.id);
                    table.ForeignKey(
                        name: "FK_client_addresses_users_client_id",
                        column: x => x.client_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "client_consent_history",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    policy_version = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    accepted_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    accepted_from_ip = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    user_agent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_client_consent_history", x => x.id);
                    table.ForeignKey(
                        name: "FK_client_consent_history_users_client_id",
                        column: x => x.client_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "orders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: true),
                    client_phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    delivery_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    is_pickup = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    idempotency_key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    order_placed_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    cost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    return_cost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    payment_state = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    payment_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    payment_currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false, defaultValue: "TJS"),
                    payment_provider = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false, defaultValue: "Legacy"),
                    payment_receiver_account = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false, defaultValue: ""),
                    payment_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    payment_comment = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    payment_expires_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    payment_confirmed_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    payment_confirmed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_stock_deducted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    comment = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    entrance = table.Column<int>(type: "integer", nullable: true),
                    floor = table.Column<int>(type: "integer", nullable: true),
                    apartment = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orders", x => x.id);
                    table.ForeignKey(
                        name: "FK_orders_pharmacies_pharmacy_id",
                        column: x => x.pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_orders_users_client_id",
                        column: x => x.client_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_orders_users_payment_confirmed_by_user_id",
                        column: x => x.payment_confirmed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "payment_intents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    reserved_order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    prescription_id = table.Column<Guid>(type: "uuid", nullable: true),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_pickup = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    delivery_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    payment_provider = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    payment_receiver_account = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    payment_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    payment_comment = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    state = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    idempotency_key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    confirmed_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    confirmed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reject_reason = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    entrance = table.Column<int>(type: "integer", nullable: true),
                    floor = table.Column<int>(type: "integer", nullable: true),
                    apartment = table.Column<int>(type: "integer", nullable: true),
                    bank_reference_code = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    bank_receipt_image_url = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    refunded_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    refund_reason = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_intents", x => x.id);
                    table.ForeignKey(
                        name: "FK_payment_intents_pharmacies_pharmacy_id",
                        column: x => x.pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payment_intents_users_client_id",
                        column: x => x.client_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_payment_intents_users_confirmed_by_user_id",
                        column: x => x.confirmed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "checkout_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    idempotency_key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    request_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    payment_transaction_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    failure_reason = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_checkout_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_checkout_requests_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_checkout_requests_users_client_id",
                        column: x => x.client_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "delivery_data",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_address_id = table.Column<long>(type: "bigint", nullable: true),
                    from_title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    from_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    from_latitude = table.Column<double>(type: "double precision", nullable: false),
                    from_longitude = table.Column<double>(type: "double precision", nullable: false),
                    to_address_id = table.Column<long>(type: "bigint", nullable: true),
                    to_title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    to_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    to_latitude = table.Column<double>(type: "double precision", nullable: false),
                    to_longitude = table.Column<double>(type: "double precision", nullable: false),
                    delivery_cost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    distance = table.Column<double>(type: "double precision", nullable: true),
                    jura_order_id = table.Column<long>(type: "bigint", nullable: true),
                    jura_status = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    jura_status_id = table.Column<int>(type: "integer", nullable: true),
                    driver_device_id = table.Column<long>(type: "bigint", nullable: true),
                    driver_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    driver_phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    recipient_code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_delivery_data", x => x.id);
                    table.ForeignKey(
                        name: "FK_delivery_data_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "order_positions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    is_rejected = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    returned_quantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    use_unit_mode = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    unit_count = table.Column<int>(type: "integer", nullable: true),
                    unit_total_price = table.Column<decimal>(type: "numeric(18,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_positions", x => x.id);
                    table.ForeignKey(
                        name: "FK_order_positions_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_order_positions_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payment_histories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    user_phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    provider = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    receiver_account = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    payment_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    payment_comment = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    confirmed_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    confirmed_by_phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    paid_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_histories", x => x.id);
                    table.ForeignKey(
                        name: "FK_payment_histories_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_payment_histories_users_confirmed_by_user_id",
                        column: x => x.confirmed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payment_histories_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "refund_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    payment_transaction_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    reason = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    type = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refund_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_refund_requests_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_refund_requests_pharmacies_pharmacy_id",
                        column: x => x.pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_refund_requests_users_client_id",
                        column: x => x.client_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payment_intent_positions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    payment_intent_id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_intent_positions", x => x.id);
                    table.ForeignKey(
                        name: "FK_payment_intent_positions_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payment_intent_positions_payment_intents_payment_intent_id",
                        column: x => x.payment_intent_id,
                        principalTable: "payment_intents",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_payment_intent_positions_pharmacies_offer_pharmacy_id",
                        column: x => x.offer_pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "refund_request_positions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    refund_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_position_id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    line_total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refund_request_positions", x => x.id);
                    table.ForeignKey(
                        name: "FK_refund_request_positions_refund_requests_refund_request_id",
                        column: x => x.refund_request_id,
                        principalTable: "refund_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "users",
                columns: new[] { "id", "date_of_birth", "deactivated_at_utc", "deactivated_by_user_id", "deactivation_reason", "gender", "name", "password_hash", "phone_number", "Role", "telegram_id", "telegram_username", "user_type" },
                values: new object[] { new Guid("3f9a5f72-3c3d-4d3b-a4d8-1c5fd2194d4a"), null, null, null, null, null, "SuperAdmin", "$2a$06$qFsTGnRwnIMyAk6g4Q6tBedOweqKHvlgZHjoy0eWYF19jgFj.7NM.", "919191919", 2, null, null, "User" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_actor_user_id",
                table: "audit_log",
                column: "actor_user_id",
                filter: "actor_user_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_correlation_id",
                table: "audit_log",
                column: "correlation_id",
                filter: "correlation_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_occurred_at_utc_desc",
                table: "audit_log",
                column: "occurred_at_utc",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "ix_basket_positions_client_id",
                table: "basket_positions",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "ix_basket_positions_medicine_id",
                table: "basket_positions",
                column: "medicine_id");

            migrationBuilder.CreateIndex(
                name: "IX_categories_parent_id",
                table: "categories",
                column: "parent_id");

            migrationBuilder.CreateIndex(
                name: "ix_categories_slug",
                table: "categories",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_categories_woo_commerce_id",
                table: "categories",
                column: "woo_commerce_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_checkout_requests_order_id",
                table: "checkout_requests",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_checkout_requests_status",
                table: "checkout_requests",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ux_checkout_requests_client_idempotency_key",
                table: "checkout_requests",
                columns: new[] { "client_id", "idempotency_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_client_addresses_client_last_used",
                table: "client_addresses",
                columns: new[] { "client_id", "last_used_at_utc" });

            migrationBuilder.CreateIndex(
                name: "ux_client_addresses_client_title",
                table: "client_addresses",
                columns: new[] { "client_id", "title" },
                unique: true,
                filter: "title IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_client_consent_history_accepted_at_utc_desc",
                table: "client_consent_history",
                column: "accepted_at_utc",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "ix_client_consent_history_client_id",
                table: "client_consent_history",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "ix_client_consent_history_policy_version",
                table: "client_consent_history",
                column: "policy_version");

            migrationBuilder.CreateIndex(
                name: "ix_delivery_data_jura_order_id",
                table: "delivery_data",
                column: "jura_order_id");

            migrationBuilder.CreateIndex(
                name: "ux_delivery_data_order_id",
                table: "delivery_data",
                column: "order_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_manual_item_lookup_requests_active",
                table: "manual_item_lookup_requests",
                columns: new[] { "status", "created_at_utc" },
                filter: "status = 0");

            migrationBuilder.CreateIndex(
                name: "ix_manual_item_lookup_requests_prescription_id",
                table: "manual_item_lookup_requests",
                column: "prescription_id");

            migrationBuilder.CreateIndex(
                name: "ix_manual_item_lookup_requests_requested_by_pharmacist_id",
                table: "manual_item_lookup_requests",
                column: "requested_by_pharmacist_id");

            migrationBuilder.CreateIndex(
                name: "ix_manual_item_lookup_responses_request_pharmacy",
                table: "manual_item_lookup_responses",
                columns: new[] { "request_id", "responding_pharmacy_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_medicine_attributes_medicine_id",
                table: "medicine_attributes",
                column: "medicine_id");

            migrationBuilder.CreateIndex(
                name: "ux_medicine_images_medicine_main",
                table: "medicine_images",
                columns: new[] { "medicine_id", "is_main" },
                unique: true,
                filter: "is_main");

            migrationBuilder.CreateIndex(
                name: "ux_medicine_images_medicine_minimal",
                table: "medicine_images",
                columns: new[] { "medicine_id", "is_minimal" },
                unique: true,
                filter: "is_minimal");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_articul",
                table: "medicines",
                column: "articul",
                unique: true,
                filter: "articul IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_category_id",
                table: "medicines",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_id_1c",
                table: "medicines",
                column: "id_1c",
                unique: true,
                filter: "id_1c IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_manual_lookup_request_id",
                table: "medicines",
                column: "manual_lookup_request_id",
                filter: "manual_lookup_request_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_manual_lookup_response_id",
                table: "medicines",
                column: "manual_lookup_response_id",
                unique: true,
                filter: "manual_lookup_response_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_non_catalog",
                table: "medicines",
                column: "is_catalog_medicine",
                filter: "is_catalog_medicine = false");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_slug",
                table: "medicines",
                column: "slug",
                unique: true,
                filter: "slug IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_woo_commerce_id",
                table: "medicines",
                column: "woo_commerce_id",
                unique: true,
                filter: "woo_commerce_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_offers_pharmacy_id",
                table: "offers",
                column: "pharmacy_id");

            migrationBuilder.CreateIndex(
                name: "ux_offers_medicine_id_pharmacy_id",
                table: "offers",
                columns: new[] { "medicine_id", "pharmacy_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_order_positions_medicine_id",
                table: "order_positions",
                column: "medicine_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_positions_order_id",
                table: "order_positions",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_client_id",
                table: "orders",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_orders_payment_confirmed_by_user_id",
                table: "orders",
                column: "payment_confirmed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_payment_state",
                table: "orders",
                column: "payment_state");

            migrationBuilder.CreateIndex(
                name: "ix_orders_pharmacy_id",
                table: "orders",
                column: "pharmacy_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_status",
                table: "orders",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_orders_status_payment_state_payment_expires_at_utc",
                table: "orders",
                columns: new[] { "status", "payment_state", "payment_expires_at_utc" });

            migrationBuilder.CreateIndex(
                name: "ux_orders_client_idempotency_key",
                table: "orders",
                columns: new[] { "client_id", "idempotency_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payment_histories_confirmed_by_user_id",
                table: "payment_histories",
                column: "confirmed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_histories_paid_at_utc",
                table: "payment_histories",
                column: "paid_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_payment_histories_user_id",
                table: "payment_histories",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ux_payment_histories_order_id",
                table: "payment_histories",
                column: "order_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_payment_intent_positions_medicine_id",
                table: "payment_intent_positions",
                column: "medicine_id");

            migrationBuilder.CreateIndex(
                name: "IX_payment_intent_positions_offer_pharmacy_id",
                table: "payment_intent_positions",
                column: "offer_pharmacy_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_intent_positions_payment_intent_id",
                table: "payment_intent_positions",
                column: "payment_intent_id");

            migrationBuilder.CreateIndex(
                name: "IX_payment_intents_confirmed_by_user_id",
                table: "payment_intents",
                column: "confirmed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_created_at_utc",
                table: "payment_intents",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "IX_payment_intents_pharmacy_id",
                table: "payment_intents",
                column: "pharmacy_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_prescription_id",
                table: "payment_intents",
                column: "prescription_id",
                filter: "prescription_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_state",
                table: "payment_intents",
                column: "state");

            migrationBuilder.CreateIndex(
                name: "ux_payment_intents_client_idempotency_key",
                table: "payment_intents",
                columns: new[] { "client_id", "idempotency_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_payment_intents_reserved_order_id",
                table: "payment_intents",
                column: "reserved_order_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_pending_refunds_client_id",
                table: "pending_refunds",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "ix_pending_refunds_prescription_id",
                table: "pending_refunds",
                column: "prescription_id");

            migrationBuilder.CreateIndex(
                name: "ix_pending_refunds_unprocessed",
                table: "pending_refunds",
                column: "processed_at_utc",
                filter: "processed_at_utc IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_pharmacies_admin_id",
                table: "pharmacies",
                column: "admin_id");

            migrationBuilder.CreateIndex(
                name: "ix_prescription_checklist_items_analog_item_id",
                table: "prescription_checklist_items",
                column: "analog_item_id",
                filter: "analog_item_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_prescription_checklist_items_analog_medicine_id",
                table: "prescription_checklist_items",
                column: "analog_medicine_id",
                filter: "analog_medicine_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_prescription_checklist_items_lookup_request_id",
                table: "prescription_checklist_items",
                column: "lookup_request_id",
                unique: true,
                filter: "lookup_request_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_prescription_checklist_items_medicine_id",
                table: "prescription_checklist_items",
                column: "medicine_id",
                filter: "medicine_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_prescription_checklist_items_prescription_id",
                table: "prescription_checklist_items",
                column: "prescription_id");

            migrationBuilder.CreateIndex(
                name: "ix_prescription_images_prescription_id",
                table: "prescription_images",
                column: "prescription_id");

            migrationBuilder.CreateIndex(
                name: "ux_prescription_images_prescription_id_order_index",
                table: "prescription_images",
                columns: new[] { "prescription_id", "order_index" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_prescriptions_assigned_pharmacist_id",
                table: "prescriptions",
                column: "assigned_pharmacist_id",
                filter: "assigned_pharmacist_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_prescriptions_client_id",
                table: "prescriptions",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "ix_prescriptions_status",
                table: "prescriptions",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_refund_request_positions_refund_request_id",
                table: "refund_request_positions",
                column: "refund_request_id");

            migrationBuilder.CreateIndex(
                name: "IX_refund_requests_client_id",
                table: "refund_requests",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "ix_refund_requests_created_at_utc",
                table: "refund_requests",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_refund_requests_order_id",
                table: "refund_requests",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "IX_refund_requests_pharmacy_id",
                table: "refund_requests",
                column: "pharmacy_id");

            migrationBuilder.CreateIndex(
                name: "ix_refund_requests_status",
                table: "refund_requests",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_sms_outbox_created_at_utc",
                table: "sms_outbox_messages",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_sms_outbox_state_next_attempt_at_utc",
                table: "sms_outbox_messages",
                columns: new[] { "state", "next_attempt_at_utc" });

            migrationBuilder.CreateIndex(
                name: "ux_sms_outbox_order_msgkey_phone",
                table: "sms_outbox_messages",
                columns: new[] { "order_id", "message_key", "phone_number" },
                unique: true,
                filter: "message_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ux_sms_outbox_order_status_phone",
                table: "sms_outbox_messages",
                columns: new[] { "order_id", "status_snapshot", "phone_number" },
                unique: true,
                filter: "message_key IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_sms_verification_sessions_expires_at_utc",
                table: "sms_verification_sessions",
                column: "expires_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_sms_verification_sessions_purpose_phone_status",
                table: "sms_verification_sessions",
                columns: new[] { "purpose", "phone_number", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_telegram_auth_sessions_expires_at_utc",
                table: "telegram_auth_sessions",
                column: "expires_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_telegram_auth_sessions_nonce",
                table: "telegram_auth_sessions",
                column: "nonce",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_tg_outbox_created_at_utc",
                table: "telegram_outbox_messages",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_tg_outbox_state_next_attempt_at_utc",
                table: "telegram_outbox_messages",
                columns: new[] { "state", "next_attempt_at_utc" });

            migrationBuilder.CreateIndex(
                name: "ux_tg_outbox_order_msgkey_chat",
                table: "telegram_outbox_messages",
                columns: new[] { "order_id", "message_key", "chat_id" },
                unique: true,
                filter: "message_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ux_tg_outbox_order_status_chat",
                table: "telegram_outbox_messages",
                columns: new[] { "order_id", "status_snapshot", "chat_id" },
                unique: true,
                filter: "message_key IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_users_pharmacy_id",
                table: "users",
                column: "pharmacy_id");

            migrationBuilder.CreateIndex(
                name: "ix_users_phone_number",
                table: "users",
                column: "phone_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_users_telegram_id",
                table: "users",
                column: "telegram_id",
                unique: true,
                filter: "telegram_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_log");

            migrationBuilder.DropTable(
                name: "basket_positions");

            migrationBuilder.DropTable(
                name: "checkout_requests");

            migrationBuilder.DropTable(
                name: "client_addresses");

            migrationBuilder.DropTable(
                name: "client_consent_history");

            migrationBuilder.DropTable(
                name: "delivery_data");

            migrationBuilder.DropTable(
                name: "manual_item_lookup_responses");

            migrationBuilder.DropTable(
                name: "medicine_attributes");

            migrationBuilder.DropTable(
                name: "medicine_images");

            migrationBuilder.DropTable(
                name: "offers");

            migrationBuilder.DropTable(
                name: "order_positions");

            migrationBuilder.DropTable(
                name: "payment_histories");

            migrationBuilder.DropTable(
                name: "payment_intent_positions");

            migrationBuilder.DropTable(
                name: "payment_settings");

            migrationBuilder.DropTable(
                name: "pending_refunds");

            migrationBuilder.DropTable(
                name: "prescription_checklist_items");

            migrationBuilder.DropTable(
                name: "prescription_images");

            migrationBuilder.DropTable(
                name: "refund_request_positions");

            migrationBuilder.DropTable(
                name: "sms_outbox_messages");

            migrationBuilder.DropTable(
                name: "sms_verification_sessions");

            migrationBuilder.DropTable(
                name: "sync_state");

            migrationBuilder.DropTable(
                name: "telegram_auth_sessions");

            migrationBuilder.DropTable(
                name: "telegram_outbox_messages");

            migrationBuilder.DropTable(
                name: "manual_item_lookup_requests");

            migrationBuilder.DropTable(
                name: "medicines");

            migrationBuilder.DropTable(
                name: "payment_intents");

            migrationBuilder.DropTable(
                name: "prescriptions");

            migrationBuilder.DropTable(
                name: "refund_requests");

            migrationBuilder.DropTable(
                name: "categories");

            migrationBuilder.DropTable(
                name: "orders");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "pharmacies");
        }
    }
}
