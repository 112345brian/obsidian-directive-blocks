--[[
  directives.lua — Pandoc Lua filter for Obsidian Directive Blocks
  Usage: pandoc input.md --lua-filter=directives.lua -o output.pdf

  Transforms fenced div classes into native Pandoc AST nodes:
    ordered  → OrderedList  (decimal)
    roman    → OrderedList  (LowerRoman)
    callout  → BlockQuote with a Strong title header
    timeline → DefinitionList

  All other Div classes are passed through unchanged.
--]]

local function flatBulletItems(blocks)
  -- Extract plain inline content from each BulletList item.
  local items = {}
  for _, block in ipairs(blocks) do
    if block.t == 'BulletList' then
      for _, item in ipairs(block.c) do
        -- item is a list of blocks; grab the first Para's inlines
        if item[1] and item[1].t == 'Para' then
          table.insert(items, item[1].c)
        end
      end
    end
  end
  return items
end

local function makeOrderedList(blocks, style)
  local items = flatBulletItems(blocks)
  if #items == 0 then
    -- Fall back: treat every Para as a list item
    for _, block in ipairs(blocks) do
      if block.t == 'Para' then
        table.insert(items, block.c)
      end
    end
  end
  local listItems = {}
  for _, inlines in ipairs(items) do
    table.insert(listItems, { pandoc.Plain(inlines) })
  end
  local attrs = { 1, style or 'Decimal', 'Period' }
  return pandoc.OrderedList(listItems, attrs)
end

local function parseCalloutAttr(classes)
  -- Extract type/title from the class list (stored as "type:info" etc.)
  -- Falls back to generic "callout" info.
  local calloutType = 'info'
  local title = nil
  for _, cls in ipairs(classes) do
    local t = cls:match('^type:(.+)$')
    if t then calloutType = t end
    local ttl = cls:match('^title:(.+)$')
    if ttl then title = ttl end
  end
  title = title or calloutType
  return calloutType, title
end

local function makeCallout(div)
  local calloutType, title = parseCalloutAttr(div.classes)
  local header = pandoc.Para({
    pandoc.Strong({ pandoc.Str(title .. ' (' .. calloutType .. ')') })
  })
  local body = div.content
  local inner = { header }
  for _, b in ipairs(body) do
    table.insert(inner, b)
  end
  return pandoc.BlockQuote(inner)
end

local function makeTimeline(blocks)
  -- Each Para whose text matches "YYYY-MM-DD: description" becomes a definition
  local items = {}
  local datePattern = '^(%d%d%d%d%-%d%d%-%d%d):%s*(.+)$'
  for _, block in ipairs(blocks) do
    if block.t == 'Para' then
      local raw = pandoc.utils.stringify(block)
      local date, desc = raw:match(datePattern)
      if date then
        local term   = { pandoc.Str(date) }
        local defn   = { { pandoc.Plain({ pandoc.Str(desc) }) } }
        table.insert(items, { term, defn })
      end
    elseif block.t == 'BulletList' then
      for _, item in ipairs(block.c) do
        local raw = pandoc.utils.stringify(pandoc.Plain(item[1] and item[1].c or {}))
        local date, desc = raw:match(datePattern)
        if date then
          local term = { pandoc.Str(date) }
          local defn = { { pandoc.Plain({ pandoc.Str(desc) }) } }
          table.insert(items, { term, defn })
        end
      end
    end
  end
  if #items == 0 then return nil end
  return pandoc.DefinitionList(items)
end

function Div(div)
  local classes = div.classes or {}

  for _, cls in ipairs(classes) do
    if cls == 'ordered' then
      return makeOrderedList(div.content, 'Decimal')
    elseif cls == 'roman' then
      return makeOrderedList(div.content, 'LowerRoman')
    elseif cls == 'callout' then
      return makeCallout(div)
    elseif cls == 'timeline' then
      local result = makeTimeline(div.content)
      if result then return result end
    end
  end

  return div
end
