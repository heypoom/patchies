<SYSTEM>This is the abridged developer documentation for Svelte and SvelteKit.</SYSTEM>

# Svelte documentation

## Svelte

You **MUST** use the Svelte 5 API unless explicitly tasked to write Svelte 4 syntax. If you don't know about the API yet, below is the most important information about it. Other syntax not explicitly listed like `{#if ...}` blocks stay the same, so you can reuse your Svelte 4 knowledge for these.

- to mark something a state you use the `$state` rune, e.g. instead of `let count = 0` you do `let count = $state(0)`
- to mark something as a derivation you use the `$derived` rune, e.g. instead of `$: double = count * 2` you do `const double = $derived(count * 2)`
- to create a side effect you use the `$effect` rune, e.g. instead of `$: console.log(double)`you do`$effect(() => console.log(double))`
- to create component props you use the `$props` rune, e.g. instead of `export let foo = true; export let bar;` you do `let { foo = true, bar } = $props();`
- when listening to dom events do not use colons as part of the event name anymore, e.g. instead of `<button on:click={...} />` you do `<button onclick={...} />`

### What are runes?

- Runes are built-in Svelte keywords (prefixed with `$`) that control the compiler. For example, you write `let message = $state('hello');` in a `.svelte` file.
- Do **NOT** treat runes like regular functions or import them; instead, use them as language keywords.  
  _In Svelte 4, this syntax did not exist—you relied on reactive declarations and stores; now runes are an integral part of the language._

### $state

- `$state` creates reactive variables that update the UI automatically. For example:
  ```svelte
  <script>
    let count = $state(0);
  </script>
  <button onclick={() => count++}>Clicked: {count}</button>
  ```
- Do **NOT** complicate state management by wrapping it in custom objects; instead, update reactive variables directly.  
  _In Svelte 4, you created state with let, e.g. `let count = 0;`, now use the $state rune, e.g. `let count = $state(0);`._
- Arrays and objects become deeply reactive proxies. For example:
  ```js
  let todos = $state([{ done: false, text: 'add more todos' }]);
  todos[0].done = !todos[0].done;
  ```
- Do **NOT** destructure reactive proxies (e.g., `let { done } = todos[0];`), as this breaks reactivity; instead, access properties directly.
- Use `$state` in class fields for reactive properties. For example:
  ```js
  class Todo {
  	done = $state(false);
  	text = $state('');
  	reset = () => {
  		this.text = '';
  		this.done = false;
  	};
  }
  ```

### $state.raw

- `$state.raw` creates shallow state where mutations are not tracked. For example:

```js
let person = $state.raw({ name: 'Heraclitus', age: 49 });
// Instead of mutating:
// person.age += 1;  // NO effect
person = { name: 'Heraclitus', age: 50 }; // Correct way to update
```

- Do **NOT** attempt to mutate properties on raw state; instead, reassign the entire object to trigger updates.

### $state.snapshot

- `$state.snapshot` produces a plain object copy of reactive state. For example:

```svelte
<script>
  let counter = $state({ count: 0 });
  function logSnapshot() {
    console.log($state.snapshot(counter));
  }
</script>
```

- **ONLY** use this if you are told there's a problem with passing reactive proxies to external APIs.

### Passing state into functions

- Pass-by-Value Semantics: Use getter functions to ensure functions access the current value of reactive state. For example:
  ```js
  function add(getA, getB) {
  	return () => getA() + getB();
  }
  let a = 1,
  	b = 2;
  let total = add(
  	() => a,
  	() => b
  );
  console.log(total());
  ```
- Do **NOT** assume that passing a reactive state variable directly maintains live updates; instead, pass getter functions.  
  _In Svelte 4, you often used stores with subscribe methods; now prefer getter functions with `$state` / `$derived` instead._

### $derived

- `$derived` computes reactive values based on dependencies. For example:

```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>
<button onclick={() => count++}>{doubled}</button>
```

- Do **NOT** introduce side effects in derived expressions; instead, keep them pure.  
  _In Svelte 4 you used `$:` for this, e.g. `$: doubled = count * 2;`, now use the $derived rune instead, e.g `let doubled = $derived(count * 2);`._

#### $derived.by

- Use `$derived.by` for multi-line or complex logic. For example:

```svelte
<script>
  let numbers = $state([1, 2, 3]);
  let total = $derived.by(() => {
    let sum = 0;
    for (const n of numbers) sum += n;
    return sum;
  });
</script>
```

- Do **NOT** force complex logic into a single expression; instead, use `$derived.by` to keep code clear.

#### Overriding derived values

- You can reassign a derived value for features like optimistic UI. It will go back to the `$derived` value once an update in its dependencies happen. For example:

```svelte
<script>
  let post = $props().post;
  let likes = $derived(post.likes);
  async function onclick() {
    likes += 1;
    try { await post.like(); } catch { likes -= 1; }
  }
</script>
```

- Do **NOT** try to override derived state via effects; instead, reassign directly when needed.  
  _In Svelte 4 you could use `$:` for that, e.g. `$: likes = post.likes; likes = 1`, now use the `$derived` instead, e.g. `let likes = $derived(post.likes); likes = 1;`._

### $effect

- `$effect` executes functions when reactive state changes. For example:

```svelte
<script>
  let size = $state(50);
  $effect(() => {
    console.log('Size changed:', size);
  });
</script>
```

- Do **NOT** use `$effect` for state synchronization; instead, use it only for side effects like logging or DOM manipulation.  
  _In Svelte 4, you used reactive statements (`$:`) for similar tasks, .e.g `$: console.log(size)`; now use the `$effect` rune instead, e.g. `$effect(() => console.log(size))` ._

#### Understanding lifecycle (for $effect)

- Effects run after the DOM updates and can return teardown functions. For example:

```svelte
<script>
  let count = $state(0);
  $effect(() => {
    const interval = setInterval(() => { count += 1; }, 1000);
    return () => clearInterval(interval);
  });
</script>
```

- **Directive:** Do **NOT** ignore cleanup; instead, always return a teardown function when needed.

#### $effect.pre

- `$effect.pre` works like `$effect` with the only difference that it runs before the DOM updates. For example:

```svelte
<script>
  let div = $state();
  $effect.pre(() => {
    if (div) console.log('Running before DOM update');
  });
</script>
```

- Do **NOT** use `$effect.pre` for standard post-update tasks; instead, reserve it for pre-DOM manipulation like autoscrolling.

#### $effect.tracking

- `$effect.tracking` indicates if code is running inside a reactive context. For example:

```svelte
<script>
  $effect(() => {
    console.log('Inside effect, tracking:', $effect.tracking());
  });
</script>
```

- Do **NOT** misuse tracking information outside its intended debugging context; instead, use it to enhance reactive debugging.  
  _In Svelte 4, no equivalent existed; now this feature offers greater insight into reactivity._

#### $effect.root

- `$effect.root` creates a non-tracked scope for nested effects with manual cleanup. For example:

```svelte
<script>
  let count = $state(0);
  const cleanup = $effect.root(() => {
    $effect(() => {
      console.log('Count is:', count);
    });
    return () => console.log('Root effect cleaned up');
  });
</script>
```

- Do **NOT** expect root effects to auto-cleanup; instead, manage their teardown manually.  
  _In Svelte 4, manual cleanup required explicit lifecycle hooks; now `$effect.root` centralizes this control._

### $props

- Use `$props` to access component inputs. For example:

```svelte
<script>
  let { adjective } = $props();
</script>
<p>This component is {adjective}</p>
```

- Do **NOT** mutate props directly; instead, use callbacks or bindable props to communicate changes.  
  _In Svelte 4, props were declared with `export let foo`; now you use `$props` rune, e.g. `let { foo } = $props()`._
- Declare fallback values via destructuring. For example:

```js
let { adjective = 'happy' } = $props();
```

- Rename props to avoid reserved keywords. For example:

```js
let { super: trouper } = $props();
```

- Use rest syntax to collect all remaining props. For example:

```js
let { a, b, ...others } = $props();
```

#### $props.id()

- Generate a unique ID for the component instance. For example:

```svelte
<script>
  const uid = $props.id();
</script>
<label for="{uid}-firstname">First Name:</label>
<input id="{uid}-firstname" type="text" />
```

- Do **NOT** manually generate or guess IDs; instead, rely on `$props.id()` for consistency.

### $bindable

- Mark props as bindable to allow two-way data flow. For example, in `FancyInput.svelte`:

```svelte
<script>
  let { value = $bindable() } = $props();
</script>
<input bind:value={value} />
```

- Do **NOT** overuse bindable props; instead, default to one-way data flow unless bi-directionality is truly needed.  
  _In Svelte 4, all props were implicitly bindable; in Svelte 5 `$bindable` makes this explicit._

### $host

- Only available inside custom elements. Access the host element for custom event dispatching. For example:

```svelte
<script>
  function dispatch(type) {
    $host().dispatchEvent(new CustomEvent(type));
  }
</script>
<button onclick={() => dispatch('increment')}>Increment</button>
```

- Do **NOT** use this unless you are explicitly tasked to create a custom element using Svelte components

### {#snippet ...}

- **Definition & Usage:**  
  Snippets allow you to define reusable chunks of markup with parameters inside your component.  
  _Example:_
  ```svelte
  {#snippet figure(image)}
    <figure>
      <img src={image.src} alt={image.caption} width={image.width} height={image.height} />
      <figcaption>{image.caption}</figcaption>
    </figure>
  {/snippet}
  ```
- **Parameterization:**  
  Snippets accept multiple parameters with optional defaults and destructuring, but rest parameters are not allowed.  
  _Example with parameters:_
  ```svelte
  {#snippet name(param1, param2)}
    <!-- snippet markup here -->
  {/snippet}
  ```

### Snippet scope

- **Lexical Visibility:**  
  Snippets can be declared anywhere and reference variables from their outer lexical scope, including script or block-level declarations.  
  _Example:_
  ```svelte
  <script>
    let { message = "it's great to see you!" } = $props();
  </script>
  {#snippet hello(name)}
    <p>hello {name}! {message}!</p>
  {/snippet}
  {@render hello('alice')}
  ```
- **Scope Limitations:**  
  Snippets are only accessible within their lexical scope; siblings and child blocks share scope, but nested snippets cannot be rendered outside.  
  _Usage caution:_ Do **NOT** attempt to render a snippet outside its declared scope.

### Passing snippets to components

- **As Props:**  
  Within a template, snippets are first-class values that can be passed to components as props.  
  _Example:_
  ```svelte
  <script>
    import Table from './Table.svelte';
    const fruits = [
      { name: 'apples', qty: 5, price: 2 },
      { name: 'bananas', qty: 10, price: 1 }
    ];
  </script>
  {#snippet header()}
    <th>fruit</th>
    <th>qty</th>
    <th>price</th>
    <th>total</th>
  {/snippet}
  {#snippet row(d)}
    <td>{d.name}</td>
    <td>{d.qty}</td>
    <td>{d.price}</td>
    <td>{d.qty * d.price}</td>
  {/snippet}
  <Table data={fruits} {header} {row} />
  ```
- **Slot-like Behavior:**  
  Snippets declared inside component tags become implicit props (akin to slots) for the component.  
  _Svelte 4 used slots for this, e.g. `<Component><p slot="x" let:y>hi {y}</p></Component>`; now use snippets instead, e.g. `<Component>{#snippet x(y)}<p>hi {y}</p>{/snippet}</Component>`._
- **Content Fallback:**  
  Content not wrapped in a snippet declaration becomes the `children` snippet, rendering as fallback content.  
  _Example:_
  ```svelte
  <!-- App.svelte -->
  <Button>click me</Button>
  <!-- Button.svelte -->
  <script>
    let { children } = $props();
  </script>
  <button>{@render children()}</button>
  ```

### Typing snippets

- Snippets implement the `Snippet` interface, enabling strict type checking in TypeScript or JSDoc.  
  _Example:_

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    data: any[];
    children: Snippet;
    row: Snippet<[any]>;
  }
  let { data, children, row }: Props = $props();
</script>
```

### {@render ...}

- Use the {@render ...} tag to invoke and render a snippet, passing parameters as needed.  
  _Example:_
  ```svelte
  {#snippet sum(a, b)}
    <p>{a} + {b} = {a + b}</p>
  {/snippet}
  {@render sum(1, 2)}
  ```
- Do **NOT** call snippets without parentheses when parameters are required; instead, always invoke the snippet correctly.  
  _In Svelte 4, you used slots for this, e.g. `<slot name="sum" {a} {b} />`; now use `{@render}` instead, e.g. `{@render sum(a,b)}`._

### <svelte:boundary>

- Use error boundary tags to prevent rendering errors in a section from crashing the whole app.
  _Example:_

  ```svelte
  <svelte:boundary onerror={(error, reset) => console.error(error)}>
    <FlakyComponent />
  </svelte:boundary>
  ```

- **Failed Snippet for Fallback UI:**  
  Providing a `failed` snippet renders fallback content when an error occurs and supplies a `reset` function.  
  _Example:_

  ```svelte
  <svelte:boundary>
    <FlakyComponent />
    {#snippet failed(error, reset)}
      <button onclick={reset}>Oops! Try again</button>
    {/snippet}
  </svelte:boundary>
  ```

### class

- Svelte 5 allows objects for conditional class assignment using truthy keys. It closely follows the `clsx` syntax  
  _Example:_

```svelte
<script>
  let { cool } = $props();
</script>
<div class={{ cool, lame: !cool }}>Content</div>
```


# SvelteKit documentation

## Project types

SvelteKit supports all rendering modes: SPA, SSR, SSG, and you can mix them within one project.

## Setup

Scaffold a new SvelteKit project using `npx sv create` then follow the instructions. Do NOT use `npm create svelte` anymore, this command is deprecated.

A SvelteKit project needs a `package.json` with the following contents at minimum:

```json
{
	"devDependencies": {
		"@sveltejs/adapter-auto": "^6.0.0",
		"@sveltejs/kit": "^2.0.0",
		"@sveltejs/vite-plugin-svelte": "^5.0.0",
		"svelte": "^5.0.0",
		"vite": "^6.0.0"
	}
}
```

Do NOT put any of the `devDependencies` listed above into `dependencies`, keep them all in `devDependencies`.

It also needs a `vite.config.js` with the following at minimum:

```js
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()]
});
```

It also needs a `svelte.config.js` with the following at minimum:

```js
import adapter from '@sveltejs/adapter-auto';

export default {
	kit: {
		adapter: adapter()
	}
};
```

## Project structure

- **`src/` directory:**
  - `lib/` for shared code (`$lib`), `lib/server/` for server‑only modules (`$lib/server`), `params/` for matchers, `routes/` for your pages/components, plus `app.html`, `error.html`, `hooks.client.js`, `hooks.server.js`, and `service-worker.js`.
  - Do **NOT** import server‑only code into client files
- **Top‑level assets & configs:**
  - `static/` for public assets; `tests/` (if using Playwright); config files: `package.json` (with `@sveltejs/kit`, `svelte`, `vite` as devDeps), `svelte.config.js`, `tsconfig.json` (or `jsconfig.json`, extending `.svelte-kit/tsconfig.json`), and `vite.config.js`.
  - Do **NOT** forget `"type": "module"` in `package.json` if using ESM.
- **Build artifacts:**
  - `.svelte-kit/` is auto‑generated and safe to ignore or delete; it will be recreated on `dev`/`build`.
  - Do **NOT** commit `.svelte-kit/` to version control.

## Routing

- **Filesystem router:** `src/routes` maps directories to URL paths: Everything with a `+page.svelte` file inside it becomes a visitable URL, e.g. `src/routes/hello/+page.svelte` becomes `/hello`. `[param]` folders define dynamic segments. Do NOT use other file system router conventions, e.g. `src/routes/hello.svelte` does NOT become available als URL `/hello`
- **Route files:** Prefix with `+`: all run server‑side; only non‑`+server` run client‑side; `+layout`/`+error` apply recursively.
- **Best practice:** Do **not** hard‑code routes in code; instead rely on the filesystem convention.

### +page.svelte

- Defines UI for a route, SSR on first load and CSR thereafter
- Do **not** fetch data inside the component; instead use a `+page.js` or `+page.server.js` `load` function; access its return value through `data` prop via `let { data } = $props()` (typed with `PageProps`).

```svelte
<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
</script>
<h1>{data.title}</h1>
```

### +page.js

- Load data for pages via `export function load({ params })` (typed `PageLoad`), return value is put into `data` prop in component
- Can export `prerender`, `ssr`, and `csr` consts here to influence how page is rendered.
- Do **not** include private logic (DB or env vars), can **not** export `actions` from here; if needed, use `+page.server.js`.

```js
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
  return {
    title: 'Hello world!',
  };
}
```

### +page.server.js

- `export async function load(...)` (typed `PageServerLoad`) to access databases or private env; return serializable data.
- Can also export `actions` for `<form>` handling on the server.

### +error.svelte

- Add `+error.svelte` in a route folder to render an error page, can use `page.status` and `page.error.message` from `$app/state`.
- SvelteKit walks up routes to find the closest boundary; falls back to `src/error.html` if none.

### +layout.svelte

- Place persistent elements (nav, footer) and include `{@render children()}` to render page content. Example:

```svelte
<script>
    import { LayoutProps } from './$types';
    let { children, data } = $props();
</script>

<p>Some Content that is shared for all pages below this layout</p>
<!-- child layouts/page goes here -->
{@render children()}
```

- Create subdirectory `+layout.svelte` to scope UI to nested routes, inheriting parent layouts.
- Use layouts to avoid repeating common markup; do **not** duplicate UI in every `+page.svelte`.

### +layout.js / +layout.server.js

- In `+layout.js` or `+layout.server.js` export `load()` (typed `LayoutLoad`) to supply `data` to the layout and its children; set `prerender`, `ssr`, `csr`.
- Use `+layout.server.js` (typed `LayoutServerLoad`) for server-only things like DB or env access.
- Do **not** perform server‑only operations in `+layout.js`; use the server variant.

```js
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = () => {
	return {
		sections: [
			{ slug: 'profile', title: 'Profile' },
			{ slug: 'notifications', title: 'Notifications' }
		]
	};
}
```

### +server.js (Endpoints)

- Export HTTP handlers (`GET`, `POST`, etc.) in `+server.js` under `src/routes`; receive `RequestEvent`, return `Response` or use `json()`, `error()`, `redirect()` (exported from `@sveltejs/kit`).
- export `fallback` to catch all other methods.

```js
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	return new Response('hello world');
}
```

### $types

- SvelteKit creates `$types.d.ts` with `PageProps`, `LayoutProps`, `RequestHandler`, `PageLoad`, etc., for type‑safe props and loaders.
- Use them inside `+page.svelte`/`+page.server.js`/`+page.js`/`+layout.svelte`/`+layout.server.js`/`+layout.js` by importing from `./$types`

### Other files

- Any non‑`+` files in route folders are ignored by the router, use this to your advantage to colocate utilities or components.
- For cross‑route imports, place modules under `src/lib` and import via `$lib`.

## Loading data

### Page data

- `+page.js` exports a `load` (`PageLoad`) whose returned object is available in `+page.svelte` via `let { data } = $props()` (e.g. when you do `return { foo }` from `load` it is available within `let { data } = $props()` in `+page.svelte` as `data.foo`)
- Universal loads run on SSR and CSR; private or DB‑backed loads belong in `+page.server.js` (`PageServerLoad`) and must return devalue‑serializable data.

Example:

```js
// file: src/routes/foo/+page.js
export async function load({ fetch }) {
	const result = await fetch('/data/from/somewhere').then((r) => r.json());
	return { result }; // return property "result"
}
```

```svelte
<!-- file: src/routes/foo/+page.svelte -->
<script>
  // "data" prop contains property "result"
  let { data } = $props();
</script>
{data.result}
```

### Layout data

- `+layout.js` or `+layout.server.js` exports a `load` (`LayoutLoad`/`LayoutServerLoad`)
- Layout data flows downward: child layouts and pages see parent data in their `data` prop.
- Data loading flow (interaction of load function and props) works the same as for `+page(.server).js/svelte`

### page.data

- The `page` object from `$app/state` gives access to all data from `load` functions via `page.data`, usable in any layout or page.
- Ideal for things like `<svelte:head><title>{page.data.title}</title></svelte:head>`.
- Types come from `App.PageData`
- earlier Svelte versions used `$app/stores` for the same concepts, do NOT use `$app/stores` anymore unless prompted to do so

### Universal vs. server loads

- Universal (`+*.js`) run on server first, then in browser; server (`+*.server.js`) always run server‑side and can use secrets, cookies, DB, etc.
- Both receive `params`, `route`, `url`, `fetch`, `setHeaders`, `parent`, `depends`; server loads additionally get `cookies`, `locals`, `platform`, `request`.
- Use server loads for private data or non‑serializable items; universal loads for public APIs or returning complex values (like constructors).

### Load function arguments

- `url` is a `URL` object (no `hash` server‑side); `route.id` shows the route pattern; `params` map path segments to values.
- Query parameters via `url.searchParams` trigger reruns when they change.
- Use these to branch logic and fetch appropriate data in `load`.

## Making Fetch Requests

Use the provided `fetch` function for enhanced features:

```js
// src/routes/items/[id]/+page.js
export async function load({ fetch, params }) {
	const res = await fetch(`/api/items/${params.id}`);
	const item = await res.json();
	return { item };
}
```

## Headers and Cookies

Set response headers using `setHeaders`:

```js
export async function load({ fetch, setHeaders }) {
	const response = await fetch(url);

	setHeaders({
		age: response.headers.get('age'),
		'cache-control': response.headers.get('cache-control')
	});

	return response.json();
}
```

Access cookies in server load functions using `cookies`:

```js
export async function load({ cookies }) {
	const sessionid = cookies.get('sessionid');
	return {
		user: await db.getUser(sessionid)
	};
}
```

Do not set `set-cookie` via `setHeaders`; use `cookies.set()` instead.

## Using Parent Data

Access data from parent load functions:

```js
export async function load({ parent }) {
	const { a } = await parent();
	return { b: a + 1 };
}
```

## Errors and Redirects

Redirect users using `redirect`:

```js
import { redirect } from '@sveltejs/kit';

export function load({ locals }) {
	if (!locals.user) {
		redirect(307, '/login');
	}
}
```

Throw expected errors using `error`:

```js
import { error } from '@sveltejs/kit';

export function load({ locals }) {
	if (!locals.user) {
		error(401, 'not logged in');
	}
}
```

Unexpected exceptions trigger `handleError` hook and a 500 response.

## Streaming with Promises

Server load functions can stream promises as they resolve:

```js
export async function load({ params }) {
	return {
		comments: loadComments(params.slug),
		post: await loadPost(params.slug)
	};
}
```

```svelte
<h1>{data.post.title}</h1>
<div>{@html data.post.content}</div>

{#await data.comments}
  Loading comments...
{:then comments}
  {#each comments as comment}
    <p>{comment.content}</p>
  {/each}
{:catch error}
  <p>error loading comments: {error.message}</p>
{/await}
```

## Rerunning Load Functions

Load functions rerun when:

- Referenced params or URL properties change
- A parent load function reran and `await parent()` was called
- A dependency was invalidated with `invalidate(url)` or `invalidateAll()`

Manually invalidate load functions:

```js
// In load function
export async function load({ fetch, depends }) {
	depends('app:random');
	// ...
}

// In component
import { invalidate } from '$app/navigation';
function rerunLoadFunction() {
	invalidate('app:random');
}
```

## Dependency Tracking

Exclude from dependency tracking with `untrack`:

```js
export async function load({ untrack, url }) {
	if (untrack(() => url.pathname === '/')) {
		return { message: 'Welcome!' };
	}
}
```

### Implications for authentication

- Layout loads don’t automatically rerun on CSR; guards in `+layout.server.js` require child pages to await the parent.
- To avoid missed auth checks and waterfalls, use hooks like `handle` for global protection or per‑page server loads.

### Using getRequestEvent

- `getRequestEvent()` retrieves the current server `RequestEvent`, letting shared functions (e.g. `requireLogin()`) access `locals`, `url`, etc., without parameter passing.

## Using forms

### Form actions

- A `+page.server.js` can export `export const actions: Actions = { default: async (event) => {…} }`; `<form method="POST">` in `+page.svelte` posts to the default action without any JS. `+page.js` or `+layout.js` or `+layout.server.js` can NOT export `actions`
- Name multiple actions (`login`, `register`) in `actions`, invoke with `action="?/register"` or `button formaction="?/register"`; do NOT use `default` name in this case.
- Each action gets `{ request, cookies, params }`, uses `await request.formData()`, sets cookies or DB state, and returns an object that appears on the page as `form` (typed via `PageProps`).

Example: Define a default action in `+page.server.js`:

```js
// file: src/routes/login/+page.server.js
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		// TODO log the user in
	}
};
```

Use it with a simple form:

```svelte
<!-- file: src/routes/login/+page.svelte -->
<form method="POST">
	<label>
		Email
		<input name="email" type="email">
	</label>
	<label>
		Password
		<input name="password" type="password">
	</label>
	<button>Log in</button>
</form>
```

### Validation errors

- Return `fail(400, { field, error: true })` from an action to send back status and data; display via `form?.field` and repopulate inputs with `value={form?.field ?? ''}`.
- Use `fail` instead of throwing so the nearest `+error.svelte` isn’t invoked and the user can correct their input.
- `fail` payload must be JSON‑serializable.

### Redirects

- In an action, call `redirect(status, location)` to send a 3xx redirect; this throws and bypasses form re-render.
- Client-side, use `goto()` from `$app/navigation` for programmatic redirects.

### Loading data after actions

- After an action completes (unless redirected), SvelteKit reruns `load` functions and re‑renders the page, merging the action’s return value into `form`.
- The `handle` hook runs once before the action; if you modify cookies in your action, you must also update `event.locals` there to keep `load` in sync.
- Do NOT assume `locals` persists automatically; set `event.locals` inside your action when auth state changes.

### Progressive enhancement

- Apply `use:enhance` from `$app/forms` to `<form>` to intercept submissions, prevent full reloads, update `form`, `page.form`, `page.status`, reset the form, invalidate all data, handle redirects, render errors, and restore focus. Do NOT use onsubmit event for progressive enhancement
- To customize, provide a callback that runs before submit and returns a handler; use `update()` for default logic or `applyAction(result)` to apply form data without full invalidation.
- You can also write your own `onsubmit` listener using `fetch`, then `deserialize` the response and `applyAction`/`invalidateAll`; do NOT use `JSON.parse` for action responses.

```svelte
<script>
  import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<form method="POST" use:enhance>
	<!-- form content -->
</form>
```

## Page options

#### prerender

- Set `export const prerender = true|false|'auto'` in page or layout modules; `true` generates static HTML, `false` skips, `'auto'` includes in SSR manifest.
- Applies to pages **and** `+server.js` routes (inherit parent flags); dynamic routes need `entries()` or `config.kit.prerender.entries` to tell the crawler which parameter values to use.
- Do NOT prerender pages that use form actions or rely on `url.searchParams` server‑side.

#### entries

- In a dynamic route’s `+page(.server).js` or `+server.js`, export `export function entries(): Array<Record<string,string>>` (can be async) to list parameter sets for prerendering.
- Overrides default crawling to ensure dynamic pages (e.g. `/blog/[slug]`) are generated.
- Do NOT forget to pair `entries()` with `export const prerender = true`.

### ssr

- `export const ssr = false` disables server-side rendering, sending only an HTML shell and turning the page into a client-only SPA.
- Use sparingly (e.g. when using browser‑only globals); do NOT set both `ssr` and `csr` to `false` or nothing will render.

#### csr

- `export const csr = false` prevents hydration, omits JS bundle, disables `<script>`s, form enhancements, client routing, and HMR.
- Ideal for purely static pages (e.g. marketing or blog posts); do NOT disable CSR on pages requiring interactivity.

## State management

- Avoid shared server variables—servers are stateless and shared across users. Authenticate via cookies and persist to a database instead of writing to in‑memory globals.
- Keep `load` functions pure: no side‑effects or global store writes. Return data from `load` and pass it via `data` or `page.data`.
- For shared client‑only state across components, use Svelte’s context API (`setContext`/`getContext`) or URL parameters for persistent filters; snapshots for ephemeral UI state tied to navigation history.

## Building your app

- Build runs in two phases: Vite compiles and prerenders (if enabled), then an adapter tailors output for your deployment target.
- Guard any code that should not execute at build time with `import { building } from '$app/environment'; if (!building) { … }`.
- Preview your production build locally with `npm run preview` (Node‑only, no adapter hooks).

## Adapters

- Adapters transform the built app into deployable assets for various platforms (Cloudflare, Netlify, Node, static, Vercel, plus community adapters).
- Configure in `svelte.config.js` under `kit.adapter = adapter(opts)`, importing the adapter module and passing its options.
- Some adapters expose a `platform` object (e.g. Cloudflare’s `env`); access it via `event.platform` in hooks and server routes.

## Single‑page apps

- Turn your app into a fully CSR SPA by setting `export const ssr = false;` in the root `+layout.js`.
- For static hosting, use `@sveltejs/adapter-static` with a `fallback` HTML (e.g. `200.html`) so client routing can handle unknown paths.
- You can still prerender select pages by enabling `prerender = true` and `ssr = true` in their individual `+page.js` or `+layout.js` modules.

## Advanced routing

- Rest parameters (`[...file]`) capture an unknown number of segments (e.g. `src/routes/hello/[...path]` catches all routes under `/hello`) and expose them as a single string; use a catch‑all route `+error.svelte` to render nested custom 404 pages.
- Optional parameters (`[[lang]]`) make a segment optional, e.g. for `[[lang]]/home` both `/home` and `/en/home` map to the same route; cannot follow a rest parameter.
- Matchers in `src/params/type.js` let you constrain `[param=type]` (e.g. only “apple” or “orange”), falling back to other routes or a 404 if the test fails.

### Advanced layouts

- Group directories `(app)` or `(marketing)` apply a shared layout without affecting URLs.
- Break out of the inherited layout chain per page with `+page@segment.svelte` (e.g. `+page@(app).svelte`) or per layout with `+layout@.svelte`.
- Use grouping judiciously: overuse can complicate nesting; sometimes simple composition or wrapper components suffice.

## Hooks

### Server hooks

- `handle({ event, resolve })`: runs on every request; mutate `event.locals`, bypass routing, or call `resolve(event, { transformPageChunk, filterSerializedResponseHeaders, preload })` to customize HTML, headers, and asset preloading.
- `handleFetch({ event, request, fetch })`: intercepts server‑side `fetch` calls to rewrite URLs, forward cookies on cross‑origin, or route internal requests directly to handlers.
- `init()`: runs once at server startup for async setup (e.g. database connections).

### Shared hooks

- `handleError({ error, event, status, message })`: catches unexpected runtime errors on server or client; log via Sentry or similar, return a safe object (e.g. `{ message: 'Oops', errorId }`) for `$page.error`.

### Universal hooks

- `reroute({ url, fetch? })`: map incoming `url.pathname` to a different route ID (without changing the address bar), optionally async and using `fetch`.
- `transport`: define `encode`/`decode` for custom types (e.g. class instances) to serialize them across server/client boundaries in loads and actions.

## Errors

- Expected errors thrown with `error(status, message|object)` set the response code, render the nearest `+error.svelte` with `page.error`, and let you pass extra props (e.g. `{ code: 'NOT_FOUND' }`).
- Unexpected exceptions invoke the `handleError` hook, are logged internally, and expose a generic `{ message: 'Internal Error' }` to users; customize reporting or user‑safe messages in `handleError`.
- Errors in server handlers or `handle` return JSON or your `src/error.html` fallback based on `Accept` headers; errors in `load` render component boundaries as usual. Type‑safe shapes via a global `App.Error` interface.

## Link options

The following are HTML attributes you can put on any HTML element.

- `data-sveltekit-preload-data="hover"|"tap"` preloads `load` on link hover (`touchstart`) or immediate tap; use `"tap"` for fast‑changing data.
- `data-sveltekit-preload-code="eager"|"viewport"|"hover"|"tap"` preloads JS/CSS aggressively or on scroll/hover/tap to improve load times.
- `data-sveltekit-reload` forces full-page reload; `data-sveltekit-replacestate` uses `replaceState`; `data-sveltekit-keepfocus` retains focus; `data-sveltekit-noscroll` preserves scroll position; disable any by setting the value to `"false"`.

## Server-only modules

- `$env/static/private` and `$env/dynamic/private` can only be imported into server‑only files (`hooks.server.js`, `+page.server.js`); prevents leaking secrets to the client.
- `$app/server` (e.g. the `read()` API) is likewise restricted to server‑side code.
- Make your own modules server‑only by naming them `*.server.js` or placing them in `src/lib/server/`; any public‑facing import chain to these files triggers a build error.

## Shallow routing

- Use `pushState(path, state)` or `replaceState('', state)` from `$app/navigation` to create history entries without full navigation; read/write `page.state` from `$app/state`.
- Ideal for UI like modals: `if (page.state.showModal) <Modal/>` and dismiss with `history.back()`.
- To embed a route’s page component without navigation, preload data with `preloadData(href)` then `pushState`, falling back to `goto`; note SSR and initial load have empty `page.state`, and shallow routing requires JS.

## Images

- Vite’s asset handling inlines small files, adds hashes, and lets you `import logo from '...png'` for use in `<img src={logo}>`.
- Install `@sveltejs/enhanced-img` and add `enhancedImages()` to your Vite config; use `<enhanced:img src="...jpg" alt="…"/>` to auto‑generate `<picture>` tags with AVIF/WebP, responsive `srcset`/`sizes`, and intrinsic dimensions.
- For CMS or dynamic images, leverage a CDN with Svelte libraries like `@unpic/svelte`; always supply high‑resolution originals (2×), specify `sizes` for LCP images, set `fetchpriority="high"`, constrain layout via CSS to avoid CLS, and include meaningful `alt` text.

## Reference docs

### Imports from `@sveltejs/kit`

- **error**: throw an HTTP error and halt request processing

  ```js
  import { error } from '@sveltejs/kit';
  export function load() {
  	error(404, 'Not found');
  }
  ```

- **fail**: return a form action failure without throwing

  ```js
  import { fail } from '@sveltejs/kit';
  export const actions = {
  	default: async ({ request }) => {
  		const data = await request.formData();
  		if (!data.get('name')) return fail(400, { missing: true });
  	}
  };
  ```

- **isActionFailure**: type‑guard for failures from `fail`

  ```js
  import { isActionFailure } from '@sveltejs/kit';
  if (isActionFailure(result)) {
  	/* handle invalid form */
  }
  ```

- **isHttpError**: type‑guard for errors from `error`

  ```js
  import { isHttpError } from '@sveltejs/kit';
  try {
  	/* … */
  } catch (e) {
  	if (isHttpError(e, 404)) console.log('Not found');
  }
  ```

- **isRedirect**: type‑guard for redirects from `redirect`

  ```js
  import { redirect, isRedirect } from '@sveltejs/kit';
  try {
  	redirect(302, '/login');
  } catch (e) {
  	if (isRedirect(e)) console.log('Redirecting');
  }
  ```

- **json**: build a JSON `Response`

  ```js
  import { json } from '@sveltejs/kit';
  export function GET() {
  	return json({ hello: 'world' });
  }
  ```

- **normalizeUrl** _(v2.18+)_: strip internal suffixes/trailing slashes

  ```js
  import { normalizeUrl } from '@sveltejs/kit';
  const { url, denormalize } = normalizeUrl('/foo/__data.json');
  url.pathname; // /foo
  ```

- **redirect**: throw a redirect response

  ```js
  import { redirect } from '@sveltejs/kit';
  export function load() {
  	redirect(303, '/dashboard');
  }
  ```

- **text**: build a plain‑text `Response`

  ```js
  import { text } from '@sveltejs/kit';
  export function GET() {
  	return text('Hello, text!');
  }
  ```

### Imports from `@sveltejs/kit/hooks`

- **sequence**: compose multiple `handle` hooks into one, merging their options

  ```js
  import { sequence } from '@sveltejs/kit/hooks';
  export const handle = sequence(handleOne, handleTwo);
  ```

### Imports from `$app/forms`

- **applyAction**: apply an `ActionResult` to update `page.form` and `page.status`

  ```js
  import { applyAction } from '$app/forms';
  // inside enhance callback:
  await applyAction(result);
  ```

- **deserialize**: parse a serialized form action response back into `ActionResult`

  ```js
  import { deserialize } from '$app/forms';
  const result = deserialize(await response.text());
  ```

- **enhance**: progressively enhance a `<form>` for AJAX submissions

  ```svelte
  <script>
    import { enhance } from '$app/forms';
  </script>
  <form use:enhance on:submit={handle}>
  ```

### Imports from `$app/navigation`

- **afterNavigate**: run code after every client‑side navigation. Needs to be called at component initialization

  ```js
  import { afterNavigate } from '$app/navigation';
  afterNavigate(({ type, to }) => console.log('navigated via', type));
  ```

- **beforeNavigate**: intercept and optionally cancel upcoming navigations. Needs to be called at component initialization

  ```js
  import { beforeNavigate } from '$app/navigation';
  beforeNavigate(({ cancel }) => {
  	if (!confirm('Leave?')) cancel();
  });
  ```

- **disableScrollHandling**: disable automatic scroll resetting after navigation

  ```js
  import { disableScrollHandling } from '$app/navigation';
  disableScrollHandling();
  ```

- **goto**: programmatically navigate within the app

  ```svelte
  <script>
    import { goto } from '$app/navigation';
    function navigate() {
      goto('/dashboard', { replaceState: true });
    }
  </script>
    <button onclick={navigate}>navigate</button>
  ```

- **invalidate**: re‑run `load` functions that depend on a given URL or custom key

  ```js
  import { invalidate } from '$app/navigation';
  await invalidate('/api/posts');
  ```

- **invalidateAll**: re‑run every `load` for the current page

  ```js
  import { invalidateAll } from '$app/navigation';
  await invalidateAll();
  ```

- **onNavigate**: hook invoked immediately before client‑side navigations. Needs to be called at component initialization

  ```js
  import { onNavigate } from '$app/navigation';
  onNavigate(({ to }) => console.log('about to go to', to.url));
  ```

- **preloadCode**: import route modules ahead of navigation (no data fetch)

  ```js
  import { preloadCode } from '$app/navigation';
  await preloadCode('/about');
  ```

- **preloadData**: load both code and data for a route ahead of navigation

  ```js
  import { preloadData } from '$app/navigation';
  const result = await preloadData('/posts/1');
  ```

- **pushState**: create a shallow‑routing history entry with custom state

  ```js
  import { pushState } from '$app/navigation';
  pushState('', { modalOpen: true });
  ```

- **replaceState**: replace the current history entry with new custom state

  ```js
  import { replaceState } from '$app/navigation';
  replaceState('', { modalOpen: false });
  ```

### Imports from `$app/paths`

- **assets**: the absolute URL prefix for static assets (`config.kit.paths.assets`)

  ```js
  import { assets } from '$app/paths';
  console.log(`<img src="${assets}/logo.png">`);
  ```

- **base**: the base path for your app (`config.kit.paths.base`)

  ```svelte
  <a href="{base}/about">About Us</a>
  ```

- **resolveRoute**: interpolate a route ID with parameters to form a pathname

  ```js
  import { resolveRoute } from '$app/paths';
  resolveRoute('/blog/[slug]/[...rest]', {
  	slug: 'hello',
  	rest: '2024/updates'
  });
  // → "/blog/hello/2024/updates"
  ```

### Imports from `$app/server`

- **getRequestEvent** _(v2.20+)_: retrieve the current server `RequestEvent`

  ```js
  import { getRequestEvent } from '$app/server';
  export function load() {
  	const event = getRequestEvent();
  	console.log(event.url);
  }
  ```

- **read** _(v2.4+)_: read a static asset imported by Vite as a `Response`

  ```js
  import { read } from '$app/server';
  import fileUrl from './data.txt';
  const res = read(fileUrl);
  console.log(await res.text());
  ```

- **navigating**: a read‑only object describing any in‑flight navigation (or `null`)

  ```svelte
  <script>
    import { navigating } from '$app/state';
    console.log(navigating.from, navigating.to);
  </script>
  ```

### Imports from `$app/state`

- **page**: read‑only reactive info about the current page (`url`, `params`, `data`, etc.)

  ```svelte
  <script>
    import { page } from '$app/state';
    const path = $derived(page.url.pathname);
  </script>
  {path}
  ```

- **updated**: reactive flag for new app versions; call `updated.check()` to poll immediately

  ```svelte
  <script>
    import { updated } from '$app/state';
    $effect(() => {
      if (updated.current) {
        alert('A new version is available. Refresh?');
      }
    })
  </script>
  ```

### Imports from `$env/dynamic/private`

- **env (dynamic/private)**: runtime private env vars (`process.env…`), not exposed to client

  ```js
  import { env } from '$env/dynamic/private';
  console.log(env.SECRET_API_KEY);
  ```

### Imports from `$env/dynamic/public`

- **env (dynamic/public)**: runtime public env vars (`PUBLIC_…`), safe for client use

  ```js
  import { env } from '$env/dynamic/public';
  console.log(env.PUBLIC_BASE_URL);
  ```

### Imports from `$env/static/private`

- **$env/static/private**: compile‑time private env vars, dead‑code eliminated

  ```js
  import { DATABASE_URL } from '$env/static/private';
  console.log(DATABASE_URL);
  ```

### Imports from `$env/static/public`

- **$env/static/public**: compile‑time public env vars (`PUBLIC_…`), safe on client

  ```js
  import { PUBLIC_WS_ENDPOINT } from '$env/static/public';
  console.log(PUBLIC_WS_ENDPOINT);
  ```

### `$lib` alias

Alias for `src/lib` folder, e.g.

```svelte
<script>
  import Button from '$lib/Button.svelte';
</script>
<Button>Click me</Button>
```

means that there's a component at `src/lib/Button.svelte`.
