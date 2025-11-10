export function clampSystemPointBaseScale(size?: number) {
	if (!Number.isFinite(size)) {
		return 1;
	}
	if (size === undefined) {
		return 1;
	}
	if (size < 0) {
		return 0;
	}
	return size;
}


