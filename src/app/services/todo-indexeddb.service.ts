import { Injectable } from '@angular/core';

export interface TodoItem {
  id?: number;
  userEmail: string;
  text: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

@Injectable({ providedIn: 'root' })
export class TodoIndexeddbService {
  private dbName = 'CourseWebDB';
  private storeName = 'todos';
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
            store.createIndex('by_user', 'userEmail', { unique: false });
            store.createIndex('by_completed', 'completed', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
    return this.dbPromise;
  }

  async listTodos(userEmail: string): Promise<TodoItem[]> {
    const db = await this.openDb();
    return new Promise<TodoItem[]>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const index = store.index('by_user');
      const req = index.getAll(IDBKeyRange.only(userEmail));
      req.onsuccess = () => {
        const list: TodoItem[] = (req.result || []).sort((a, b) => b.createdAt - a.createdAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async addTodo(userEmail: string, text: string): Promise<TodoItem> {
    const db = await this.openDb();
    const now = Date.now();
    const item: TodoItem = { userEmail, text, completed: false, createdAt: now, updatedAt: now };
    return new Promise<TodoItem>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.add(item);
      req.onsuccess = () => resolve({ ...item, id: req.result as number });
      req.onerror = () => reject(req.error);
    });
  }

  async updateTodo(item: TodoItem): Promise<TodoItem> {
    const db = await this.openDb();
    const updated: TodoItem = { ...item, updatedAt: Date.now() };
    return new Promise<TodoItem>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.put(updated);
      req.onsuccess = () => resolve(updated);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteTodo(id: number): Promise<void> {
    const db = await this.openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
