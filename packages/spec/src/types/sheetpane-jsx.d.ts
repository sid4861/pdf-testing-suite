// sheetpane's own JSX typings for its two tags.
//
// `@sheetpane/grid/jsx` is generated from the package's
// `custom-elements.json`, so the attribute names and their allowed values
// are the element's rather than my reading of the README. Hand-declaring
// them here was the first attempt and it was worse in both directions: it
// drifts, and declaring `IntrinsicElements` twice for the same tag has the
// two declarations fight — `results="summary"` came out as `undefined`.
//
// **It types React 19.** React 19 sets properties and listens to
// `onsheetpane-…` props on a custom element natively; **React 18, which
// this app is on, sets attributes only**. So the typings offer more than
// the app can use, and `SheetView.tsx` reaches for a ref to set the `file`
// property, to call `setErrors`, and to listen. Those are the parts that
// would silently do nothing if written as props — not a typing bug, a
// version gap, and the ref goes away when the app moves to 19.

import type {} from '@sheetpane/grid/jsx';
