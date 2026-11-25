/** Shown by the "Example" button: a realistic create-order request schema. */
export const EXAMPLE_SCHEMA = JSON.stringify(
  {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "CreateOrderRequest",
    type: "object",
    required: ["customer", "items", "currency"],
    properties: {
      customer: {
        type: "object",
        required: ["id", "name", "email"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
        },
      },
      items: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: { $ref: "#/$defs/LineItem" },
      },
      currency: { enum: ["BDT", "USD", "MYR"] },
      couponCode: { type: ["string", "null"], maxLength: 10 },
      shippingAddress: { $ref: "#/$defs/Address" },
      note: { type: "string", maxLength: 120 },
    },
    $defs: {
      LineItem: {
        type: "object",
        required: ["productId", "quantity", "price"],
        properties: {
          productId: { type: "string", format: "uuid" },
          product: { type: "string" },
          quantity: { type: "integer", minimum: 1, maximum: 5 },
          price: { type: "number", minimum: 1, maximum: 200, multipleOf: 0.01 },
        },
      },
      Address: {
        type: "object",
        required: ["street", "city", "country"],
        properties: {
          street: { type: "string" },
          city: { type: "string" },
          zip: { type: "string" },
          country: { type: "string" },
        },
      },
    },
  },
  null,
  2,
);
