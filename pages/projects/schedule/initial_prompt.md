
I am making an app for managing tasks. We use drag and drop in columns:

- App header
  - right aligned: drop down menu (three points), single entry:
    - show done tasks
- First column (fixed on the left), vertically divides in 2 parts:
  - Current tasks
  - Upcoming tasks
- Scrollable columns (scrollable horizontally):
  - remaining months of this year (including current month)
  - single column for months next year
    - all months are in the same column stacked vertically
  - single column for 5 years after that
    - the next 5 years are in the same column stacked vertically

We use drag and drop to move tasks between columns and stacked areas in columns.

### Task widget

Layout:

```
DUE_DATE  PRIO  Title  MENU (...)  FOLD_BUTTON (arrow down)
Description (partially)
```

- Menu entries:
  - Edit
  - Done/Undone: toggles task completion status
    - when done: hide it in view
    - when the "Show done tasks" option is enabled: show done tasks in view again (in their original columns)
      - visually distinct: grayed out, title strikethrough
    - sub tasks (if any) keep their task state when a parent task is done
  - Delete: deletes the whole task (permanently removed, no archive), use a confirm dialog
- DUE_DATE, PRIO and FOLD_BUTTON are shown only if set
  - when a task contains sub tasks show the FOLD_BUTTON
    - clicking the button expands a flat list of sub tasks below the description
    - each of these sub tasks can be clicked: we use the same edit form for it
  - done sub tasks remain in the foldable list (grayed out, title strikethrough)
- DUE_DATE format shown in UI: "MM DD" cause shorter than showing full date
- PRIO: use nice icon(s)

### Edit form (modal)

- Title (editable)
- Description (full)
- Priority
- Due date (optional)
- list of sub tasks (add, edit)
  - add button
  - entries:
    - Name
    - menu:
      - Done/Undone
      - Delete
  - edit on click (use the same dialog as for the main task, currently show no second level sub tasks)

### Data format

Save data in a single yml file `users/default/data.yml`

```yml
comment:    A comment line to be shown on app header
firstCol:
  current:
    My task:          # task title
      done: false
      due:  DUE_DATE  # we currently use no time, date only YYYY-MM-DD
      prio: PRIO      # numeric 1-5
      desc: |
        Description ...
      sub tasks:
        My sub task: 
          done: false # sub tasks have same data fields (including sub tasks)
          ...         # in the UI we currently only show the first level of sub tasks (see FOLD_BUTTON feature above)
  upcoming:
thisYear:
  05:
    My task 2:        # same task structure as above
      ...
  06:
    ...
nextYear:
  01:
    My task 3:        # same task structure as above
      ...
followingYears:       # 5 years after the next year
  2027:               # this is organized by years only (no months)
    My task 4:        # same task structure as above
      ...
```

### Misc

- When tasks with specific due dates are moved between months just let the date be the same
- The user decides where a task is sorted by dragging (move it in the data file on save)
- When a month is over (based on the current date)
  - all undone tasks from the current month column are moved to the next month/year
  - when a new month is detected done tasks are moved to `users/default/archive.yml` and removed from `data.yml`
    - archive has a simple structure
      ```yml
      2025-05:
        My done task:
          due:  DUE_DATE
          prio: PRIO
          desc: |
            Description ...
          sub tasks:
            My sub task:
              ...
      ```
    - tasks from Current and Upcoming that get marked as done => archive them under the current month
      next time when a month change is detected
  - leave tasks from Current and Upcoming that are undone untouched

### Design

- Decide if bootstrap 5.3 plus own styles is better or own styles only for this app
- Make the app look nice. We primarily use it on desktop. If possible make it usable on smartphones as well.
