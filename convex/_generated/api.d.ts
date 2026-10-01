/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as classroom from "../classroom.js";
import type * as http from "../http.js";
import type * as lib_boardColors from "../lib/boardColors.js";
import type * as lib_lessonNumber from "../lib/lessonNumber.js";
import type * as lib_presenterNotes from "../lib/presenterNotes.js";
import type * as lib_requireTeacher from "../lib/requireTeacher.js";
import type * as lib_room from "../lib/room.js";
import type * as lib_slides from "../lib/slides.js";
import type * as lib_teachers from "../lib/teachers.js";
import type * as migrations from "../migrations.js";
import type * as polls from "../polls.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  classroom: typeof classroom;
  http: typeof http;
  "lib/boardColors": typeof lib_boardColors;
  "lib/lessonNumber": typeof lib_lessonNumber;
  "lib/presenterNotes": typeof lib_presenterNotes;
  "lib/requireTeacher": typeof lib_requireTeacher;
  "lib/room": typeof lib_room;
  "lib/slides": typeof lib_slides;
  "lib/teachers": typeof lib_teachers;
  migrations: typeof migrations;
  polls: typeof polls;
  seed: typeof seed;
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
