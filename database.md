# Student Matching System Database Specification

## Overview

本システムは、大学内の学生同士を「共通の趣味」と「共通の空きコマ」に基づいてマッチングし、交流イベントを生成することを目的とする。

データベースには以下の情報を保存する。

* ユーザー情報
* 趣味情報
* 空きコマ情報
* 教室情報
* イベント情報
* イベント参加者情報

使用データベースは SQLite（maomao.db）である。

---

# Table Structure

## users

ユーザーの基本情報を管理するテーブル。

| Column   | Type    | Description  |
| -------- | ------- | ------------ |
| id       | INTEGER | ユーザーID（自動採番） |
| nickname | TEXT    | ニックネーム（重複不可） |

### Example

| id | nickname |
| -- | -------- |
| 1  | Suzuki   |
| 2  | Tanaka   |

---

## user_hobbies

ユーザーが登録した趣味タグを管理するテーブル。

1人のユーザーが複数の趣味を登録できる。

| Column  | Type    | Description |
| ------- | ------- | ----------- |
| user_id | INTEGER | ユーザーID      |
| hobby   | TEXT    | 趣味タグ        |

### Example

| user_id | hobby |
| ------- | ----- |
| 1       | Movie |
| 1       | Music |
| 2       | Movie |

---

## user_free_times

ユーザーの空きコマを管理するテーブル。

1人のユーザーが複数の空きコマを登録できる。

| Column  | Type    | Description |
| ------- | ------- | ----------- |
| user_id | INTEGER | ユーザーID      |
| day     | TEXT    | 曜日          |
| period  | INTEGER | 時限          |

### Example

| user_id | day | period |
| ------- | --- | ------ |
| 1       | Mon | 3      |
| 1       | Tue | 2      |
| 2       | Mon | 3      |

---

## rooms

交流イベントに利用できる教室情報を管理するテーブル。

| Column    | Type    | Description |
| --------- | ------- | ----------- |
| id        | INTEGER | 教室ID        |
| room_name | TEXT    | 教室名         |
| day       | TEXT    | 曜日          |
| period    | INTEGER | 時限          |

### Example

| id | room_name | day | period |
| -- | --------- | --- | ------ |
| 1  | 3A201     | Mon | 3      |
| 2  | 3A202     | Mon | 3      |

---

## events

生成されたイベントを管理するテーブル。

| Column    | Type    | Description |
| --------- | ------- | ----------- |
| id        | INTEGER | イベントID      |
| hobby     | TEXT    | 趣味タグ        |
| day       | TEXT    | 曜日          |
| period    | INTEGER | 時限          |
| room_name | TEXT    | 割り当て教室      |

### Example

| id | hobby | day | period | room_name |
| -- | ----- | --- | ------ | --------- |
| 1  | Movie | Mon | 3      | 3A201     |

---

## event_members

イベント参加者を管理するテーブル。

イベントとユーザーの対応関係を保存する。

| Column   | Type    | Description |
| -------- | ------- | ----------- |
| event_id | INTEGER | イベントID      |
| user_id  | INTEGER | ユーザーID      |

### Example

| event_id | user_id |
| -------- | ------- |
| 1        | 1       |
| 1        | 2       |
| 1        | 3       |

---

# Table Relationships

users

├── user_hobbies

├── user_free_times

└── event_members

 

events

└── event_members

---

# Matching Flow

1. ユーザーがニックネームを登録する。
2. ユーザーが趣味タグを複数登録する。
3. ユーザーが空きコマを複数登録する。
4. 管理者がマッチング処理を実行する。
5. 同じ趣味かつ同じ空きコマを持つユーザーを検索する。
6. 3人以上集まった場合、イベントを生成する。
7. 空いている教室を割り当てる。
8. events テーブルへイベントを登録する。
9. event_members テーブルへ参加者を登録する。

---

# Notes

* ニックネームは重複不可とする。
* 趣味タグは複数登録可能。
* 空きコマは複数登録可能。
* イベント開催条件は3人以上とする。
* 1教室につき1イベントのみ開催可能。
* マッチングは管理者による手動実行とする。
* イベント終了後はデータをリセットし、履歴は保持しない。
