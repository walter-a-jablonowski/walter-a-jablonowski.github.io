
## NinjaSnipp

A snippet manager app produced with AI **fast and cost-efficient** with AI

- Effort with AI just a few afternoons as a side project
- Manual development effort would be: easily 2-3 months at least (much code: https://github.com/walter-a-jablonowski/NinjaSnipp/blob/main/PHP%20manager%20app/controller.js)

View project: https://github.com/walter-a-jablonowski/NinjaSnipp

[ NinjaSnipp.png ]

### Development process

Tools used:

- Windsurf IDE
- Claude Sonnet, GPT-5, Grok Code Fast 1

#### Initial prompt

Development was started with an initial prompt that includes the most important information: https://github.com/walter-a-jablonowski/NinjaSnipp/blob/main/PHP%20manager%20app/ai.md The AI did an initial version of the app.

#### Fine tuning

Then a series of prompts was used to fix/finish detail features of the app. Code written entirely by AI with human oversight.

Result commits: https://github.com/walter-a-jablonowski/NinjaSnipp/commits/main

Sample prompts:

- [x] use modal ins of simple dlg

  > When I press #duplicateSnippetBtn or #deleteSnippetBtn simple browser input dialogs are used. Instead use bootstrap modal.

  > This didn't look right. Add new modals similar to these existing ones @index.php#L217-272 
  >
  > Then you must alter the currently used js code: @controller.js#L442-463 @controller.js#L420-441 

- [x] fix search

  > Looks like using the #searchInput doen't work correctly.
  > 
  > - Search in the current data folder selected via #dataFolderSelect only
  > - Match file and folder names as well as content from this data folder

  > Looks like results are displayed in #fileList
  > 
  > - Currently there are no results displayed searching for "html" (file name) or "form" (content)
  > - Make sure that we can go back to the previous list using #backBtn

- [x] also allow plain text edits before copy
  - simple solution: replace use of this.renderedText with a preview text below #inlineSnippet again
  - make text elements in #inlineSnippet editable (convert to spans like the editable fields)
    ```html
    Template currently are rendered like:

      <div id="inlineSnippet" class="inline-snippet">

        const

        <span class="ph ph-text" contenteditable="true" tabindex="0" data-ph="name" data-default="myArray">myArray</span>

      ...

      </div>

    Strings that are no placeholders like "const" are just text. I need these editable as well (with no background color). Maybe it would be a good idea to wrap those static texts in a span. Do you have a better idea?
    ```

- [x] ins of 2 menus see offcanvas-demo.html
  - [-] maybe: spacing issue mobile menu, misc stuff

  > The layout on larger screens is broken. The main element is displayed lower than #sidebarNav instead of beside it. It looks like we are currently using a custom offcanvas implementation.
  >
  > I provided you a sample for a correct offcanvas implementation in offcanvas-demo.html that uses bootstrap 5.3. Edit index.php and replace the current sidebar/offcanvas implementation with a plain bootstrap offcanvas implementation. Overall make it state of the art bootstrap code and make it work on all devices. Then review the stylesheet (and if relevant controller.js) and update it, e.g. remove redundant code.

- [x] fix layout issue on large screens

  > The layout on larger scrreens is broken. The main element is displayed lower than #sidebarNav instead of beside it. The layout on smaller screens and smartphone looks good.
  >
  > Design: While on larger screens the sidebar is always visible it must slide in as an overlay from left to right on small screens and smartphone.
  >
  > Review the tag structure and bootstrap classes for the sidebar/menu used in index.php. I assume that something there isn't as it must be. You may alter all neccessary html elements and classes. Overall make it state of the art bootstrap code and make it work on all devices. Then review the stylesheet.

- [x] limit recent to current data folder

  > recent_snippets.json saves a list of recent files for all data folders (selectable in #dataFolderSelect.). Data folders are defined here: @config.yml#L10-12 
  >
  > This isn't right. Instead it must save one list per data folder. We limit recent files list to current data folder. Use the key from config.yml as parent key in the json file.

- [x] `includedSameIndent: true`

  > I have added a setting includedSameIndent to config. When this is true try to apply the current indentation if the include placeholder to all lines if the included content.

- [-] maybe trim included
- [x] fix include

  > The include syntax `{{ include: "error-handling" }}` isn't rendered correctly @function-template.yml#L15-16 in #inlineSnippet. The string "error-handling" is the file name of the snippet to include for the data folder currently selected in #dataFolderSelect.

  > If there are further includes in the included file these must be resolved as well (multiple levels). When there are placeholders (`{placholder}`, `{placholder=default}`), and so on) in te included file in #inlineSnippet these must be editable in the same way as the placeholders in the main file (user can fill out).

- [x] file system include feature `11 INCLUDE error-handling`

  > I have added a demo file `11 INCLUDE error-handling` with no extension and no content. When you read which data files there are we need to resolve this entry. It wirks similar to a soft link: "INCLUDE" upper case identifies that it is an include entry instead of a snippet. There may be any string before INCLUDE. The string behind it is the name of a file of a folder from the currently selected data folder (e.g. demo_data_1), which  may also be in a sub folder of the data folder. Whenever we read snippets we need to replace the INCLUDE entry with the referenced file or with the folder (and all of its sub folders).

- [x] layout

  > Currently in this app the smartphone layout when I click navbar-toggler-icon the sidebar slides in from top to button. Instead is must slide in from left to right as an overlay.
  >
  > Prefer boostrap classes for this, update the existing styles as needed. You may alter the sidebarNav, but make sure that its content stays as it yurrently is.

- [x] fill vars in rendered with no form just by tab

  - [x] prompt
    
    > Currently we use a form for filling in the placeholders in the rendered snippet. Instead there must be a single element that show the snippet content with included snippets already added. Then the user can tab over the remaining placeholders and fill in the values.
    > 
    > - When a placholder appears multiple times, all of these will be replaced by the value when the user enters it once
    > - For choice like `{placholder=one|two|three}` we need a popup
    > - If a user use tabs over a placeholder without entering a value, use the default value if set `{placholder=default}`
  
  - [-] debug this, still has some problems
