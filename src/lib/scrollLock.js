/**
 * Counter-based body scroll lock for nested modals.
 *
 * Each modal calls lockScroll() on mount and unlockScroll() on unmount.
 * Body overflow is only restored to '' when ALL modals have unmounted.
 *
 * Usage in any modal:
 *   useEffect(() => { lockScroll(); return unlockScroll; }, []);
 */

let count = 0;

export function lockScroll() {
  count++;
  document.body.style.overflow = 'hidden';
}

export function unlockScroll() {
  count--;
  if (count <= 0) {
    count = 0;
    document.body.style.overflow = '';
  }
}
