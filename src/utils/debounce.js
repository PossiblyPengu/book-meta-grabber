export function debounce(fn, ms = 300) {
  let id;
  const debounced = (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(id);
  return debounced;
}
