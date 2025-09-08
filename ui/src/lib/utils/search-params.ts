export const setSearchParam = (key: string, value: string) => {
	const currentUrl = new URL(window.location.href);
	const searchParams = currentUrl.searchParams;

	searchParams.set(key, value);

	window.history.pushState({}, '', currentUrl);
};

export const getSearchParam = (key: string): string | null => {
	const currentUrl = new URL(window.location.href);

	return currentUrl.searchParams.get(key);
};

export const deleteSearchParam = (key: string) => {
	const currentUrl = new URL(window.location.href);
	const searchParams = currentUrl.searchParams;
	searchParams.delete(key);

	window.history.pushState({}, '', currentUrl);
};
