/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as agentState from "../agentState.js";
import type * as apiProducts from "../apiProducts.js";
import type * as apiRequests from "../apiRequests.js";
import type * as functions_workspaces from "../functions/workspaces.js";
import type * as managedCredits from "../managedCredits.js";
import type * as orders from "../orders.js";
import type * as providers from "../providers.js";
import type * as receipts from "../receipts.js";
import type * as users from "../users.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  agentState: typeof agentState;
  apiProducts: typeof apiProducts;
  apiRequests: typeof apiRequests;
  "functions/workspaces": typeof functions_workspaces;
  managedCredits: typeof managedCredits;
  orders: typeof orders;
  providers: typeof providers;
  receipts: typeof receipts;
  users: typeof users;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
