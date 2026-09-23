# ShoppieChat Architecture & Copilot Context

Technical context document for GitHub Copilot and future ShoppieChat development

## 1. Purpose

ShoppieChat is an optional AI sales-assistant service built on top of ShoppieApp.

ShoppieApp remains the source of truth for vendors/businesses, products, prices, stock, orders, and business settings.

ShoppieChat must not create a duplicate business/vendor catalogue or duplicate product catalogue.

### 2. Existing Core ShoppieApp Tables

### 2.1 public.vendors

The existing vendors table represents a business/vendor.

Columns: id (uuid primary key); user_id (uuid, references auth.users); location_id (uuid, references public.locations); shop_name; shop_description; is_open; created_at; updated_at.

Ownership is derived from vendors.user_id = auth.uid().

IMPORTANT: Do not create a separate businesses table for ShoppieChat.

### 2.2 public.products

The existing products table is the source of truth for products.

Columns: id (uuid primary key); vendor_id (uuid, references public.vendors); name; description; price numeric(10,2); image_url; in_stock; created_at; updated_at.

IMPORTANT: Do not create a duplicate ShoppieChat products/catalogue table unless explicitly approved.

### 3. Existing ShoppieChat Tables

### 3.1 public.shoppiechat_services

One ShoppieChat service per vendor.

Columns: id; vendor_id (unique); status; activated_at; paused_at; suspended_at; created_at; updated_at.

Allowed statuses: INACTIVE, ACTIVE, PAUSED, SUSPENDED.

Relationship: vendors 1 → 1 shoppiechat_services.

### 3.2 public.shoppiechat_installations

Stores server-to-server ShoppieChat connections.

Columns: id; vendor_id; name (default ShoppieChat); token_hash (unique); status; last_used_at; created_at; updated_at.

Allowed statuses: active, revoked.

Plaintext installation tokens must never be stored. Only token hashes are stored.

### 3.3 public.shoppiechat_whatsapp_connections

Stores the WhatsApp connection belonging to a ShoppieChat service.

Columns: id; service_id (unique); status; phone_number; connected_at; last_seen_at; created_at; updated_at.

Allowed statuses: NOT_CONNECTED, PAIRING, CONNECTED, DISCONNECTED, ERROR.

Relationship: shoppiechat_services 1 → 1 shoppiechat_whatsapp_connections.

### 3.4 public.shoppiechat_configurations

Stores AI assistant configuration for a ShoppieChat service.

Columns: id; service_id (unique); assistant_name; welcome_message; languages; human_handover_enabled; created_at; updated_at.

Defaults: assistant_name = ShoppieChat Assistant; welcome_message = Hello! How can I help you today?; languages = ['en']; human_handover_enabled = true.

Relationship: shoppiechat_services 1 → 1 shoppiechat_configurations.

## 4. Overall Data Architecture

vendors → products

vendors → shoppiechat_services → shoppiechat_configurations

vendors → shoppiechat_services → shoppiechat_whatsapp_connections

vendors → shoppiechat_installations

## 5. Source of Truth

Product information, price and stock must come from public.products.

Business information must come from public.vendors.

Business location must use the existing vendors.location_id → public.locations relationship.

ShoppieChat configuration comes from public.shoppiechat_configurations.

WhatsApp connection state comes from public.shoppiechat_whatsapp_connections.

Service activation comes from public.shoppiechat_services.

## 6. Required ShoppieChat Operations

search_products(); get_product(); check_stock(); get_business_info(); calculate_order_total(); create_order(); get_order(); update_order_status(); request_human_assistance().

The AI should use controlled operations rather than unrestricted database access.

## 7. AI Data Rules

The AI must never invent products, prices, stock availability, order success, or business policies.

It must never access another vendor's products or business information.

It must never expose Supabase service-role credentials or installation token hashes.

It must never modify another vendor's data.

It must not create duplicate tables merely because an AI-generated schema suggests them.

## 8. Vendor Isolation

Every ShoppieChat request must be scoped to the authorized vendor.

Never trust a client-provided vendor_id as proof of ownership.

Ownership should resolve through auth.uid() → vendors.user_id → vendors.id → ShoppieChat data.

Server-side service-role operations must still explicitly enforce vendor scoping.

Supabase RLS should be used wherever browser/user access is possible.

## 9. WhatsApp Architecture

Customer → WhatsApp → ShoppieChat AI → secure ShoppieApp service/API layer → existing Supabase data → ShoppieApp order → vendor owner notification.

WhatsApp credentials/session data must never be placed in frontend code, committed to GitHub, exposed in API responses, or printed in logs.

Each vendor must have an isolated WhatsApp connection.

The WhatsApp provider should be abstracted so it can later move from an unofficial provider such as Baileys to an official WhatsApp Business API.

## 10. Orders

ShoppieChat orders should become normal ShoppieApp orders.

Use the existing ShoppieApp order schema if one already exists. Do not create a duplicate ShoppieChat order system.

Snapshot purchased product name and price at order time.

Check stock before confirmation and again during order creation where necessary.

Prevent overselling/race conditions.

Do not claim success if order persistence fails.

Return an order reference/link after successful creation.

## 11. Owner Commands

Future owner commands may include ACCEPT 1042, REJECT 1042, and HOLD 1042.

Only the verified owner of the relevant business may execute owner commands. Validation must occur server-side.

## 12. Human Handover

Supported states: AI_ACTIVE, HUMAN_REQUIRED, HUMAN_ACTIVE, CLOSED.

When a business owner takes over, automatic AI replies should stop until control is returned to AI.

## 13. Supported Languages

Initial languages: English, Shona and Ndebele.

The architecture should allow additional languages later.

Use shoppiechat_configurations.languages rather than creating another language table unless genuinely required.

## 14. Planned Implementation Phases

Phase 1 — Integration Foundation: secure ShoppieApp ↔ ShoppieChat service boundary, vendor-scoped access, inspect and harden RLS where required.

Phase 2 — Business Activation: activate ShoppieChat for an existing vendor using shoppiechat_services.

Phase 3 — Business/Product Data Access: securely search existing products, prices, stock and business information without duplication.

Phase 4 — WhatsApp Connection: pairing, secure persistence, reconnection and vendor isolation.

Phase 5 — AI Sales Assistant: customer conversations, product discovery, business information, English/Shona/Ndebele and no hallucinated data.

Phase 6 — WhatsApp Orders: real ShoppieApp orders, stock validation, confirmation and owner notification.

Phase 7 — Owner Notifications & Human Handover: owner commands, human takeover and AI pause.

Phase 8 — Security & Production Hardening: RLS, authentication, secrets, rate limiting, logging, error handling, race-condition testing and production checks.

## 15. Critical Instructions for GitHub Copilot

Inspect the existing repository before changing code.

Inspect the existing Supabase integration.

Inspect existing ShoppieChat code.

Inspect existing database, order, conversation and message schemas before creating anything.

Reuse existing tables and components whenever possible.

Do not create duplicate tables or a duplicate businesses table.

Do not create a duplicate products catalogue.

Do not replace working architecture without a documented reason.

Make the smallest safe change required for the current phase.

Preserve existing ShoppieApp functionality.

Keep TypeScript strict and production-safe.

Run type checking, builds and tests when available.

Never commit secrets.

Never expose service-role keys in client components.

Never expose WhatsApp credentials.

Never bypass RLS simply to simplify frontend development.

Do not move to the next phase until the current phase is working.

## 16. Security Considerations

Relevant ShoppieChat tables have RLS enabled, but policies must be inspected before implementing vendor-facing functionality.

Never rely solely on a frontend-supplied vendor ID.

Environment variables/server-side secret storage must be used for service-role keys, WhatsApp credentials, installation tokens, AI provider secrets and Cloudinary secrets.

Supabase service-role keys must only be used in trusted server-side code.

## 17. Central Architecture Principle

ShoppieApp is the source of truth.

ShoppieChat is an authorized service layer that uses ShoppieApp data.

A business should manage products, prices, stock, business information, orders and settings once inside ShoppieApp.

ShoppieChat should automatically use the current information. The business must not have to enter the same product information twice.

Before implementing anything that conflicts with this architecture, stop and inspect the existing architecture first.
