export interface ListItem {
  id: string;
  choiceCode: string;
  collegeCode: string;
  collegeName: string;
  branch: string;
  seatType: string;
  closingMerit: number;
  year: number;
}

const KEY = "compass_list_v1";

export function loadList(): ListItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ListItem[]) : [];
  } catch {
    return [];
  }
}

export function saveList(items: ListItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function isInList(choiceCode: string): boolean {
  return loadList().some((i) => i.choiceCode === choiceCode);
}

export function addToList(item: Omit<ListItem, "id">): ListItem[] {
  const list = loadList();
  if (list.some((i) => i.choiceCode === item.choiceCode)) return list;
  const updated = [...list, { ...item, id: `${item.choiceCode}-${Date.now()}` }];
  saveList(updated);
  return updated;
}

export function removeFromList(id: string): ListItem[] {
  const updated = loadList().filter((i) => i.id !== id);
  saveList(updated);
  return updated;
}
