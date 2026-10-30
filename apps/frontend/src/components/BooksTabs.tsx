import { NavLink } from "react-router-dom";

// The main nav's one "Books" tab opens the suggestions; this switches
// between them and the shelf.
const BooksTabs = () => (
  <nav aria-label="Books" className="books-tabs">
    <NavLink to="/books/suggestions">Suggestions</NavLink>
    <NavLink to="/books/read">Our shelf</NavLink>
  </nav>
);

export default BooksTabs;
