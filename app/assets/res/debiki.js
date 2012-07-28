/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */

// In this file:
// - jQuery extension functions, prefixed with "dw" to avoid name clashes
// - The implementation of the Debiki module
// - A jQuery onload handler

// Google Closure Linter: Run like so:
//  gjslint src/main/resources/toserve/js/debiki.js | egrep -v 'E:0002:'

/*{{{ Bug avoidance notes

For an <a>, use this.hash not $(this).attr('href'), because in IE 7
attr() prepends 'http://server/.../page' to the href.  Related:
  http://goo.gl/OF16Q  — the JavaScript Bible page 603
  http://webmasters.stackexchange.com/questions/20621/
                    okay-to-use-the-hash-dom-node-property

}}}*/
/* {{{ Misc naming notes

 dwCoSid:
  "dw" is a prefix, avoids name clashes.
  "Co" means "Cookie".
  "Sid" is the cookie name.

 dwEvLoggedInOut:
  "Ev" means "event".
  "LoggedInOut" is the event.

 So you can do: grep dwCo, grep dwEv

 HTML5 data attributes names:  ??
 Like the CSS class names, but underscore not hyphen, so as to aovid
 uppercase/hyphen conversion. (E.g. 'data-variable-name' is converted to
 variableName (no hyphen, uppercase 'N'), and back, according to the html5
 spec: <http://www.w3.org/TR/html5/elements.html#
          embedding-custom-non-visible-data-with-the-data-attributes>
 Using underscoer ensures the data names in the html doc matches
 the names in the Javascript source code which avoids confusion.
 Example:  zd_t_id  means:  folded (zd, 'z' is fold)  thread (t)  id (id).
 But don't use:  zd-t-id, that'd be converted to 'zdTId' I think.
 If the data is only set and read via Javascript (never serialized to html),
 then please use 'dwDataName' (then you know you need only consider the
 javascript files (this file) should you want to rename it).)

 Let names of functions that return a jQuery object end with $.
 Let names of functions that should be passed to jQuery.each start with $.
 Let jQuery objects start with $.
 Currently jQuery extensions are prefixed by 'dw', e.g. $post.dwAuthorId().
 Example:
   var $header = findPostHeader$(postId);
   $header.each($doSomething);

}}}*/


//========================================
   (function(){
//========================================
//----------------------------------------
   jQuery.noConflict()(function($){
//----------------------------------------

"use strict";

// Import namespaces as `d.i` and `d.u`.
var d = { i: debiki.internal, u: debiki.v0.util };

// Import terribly frequently used functions.
var die = d.u.die;
var die2 = d.u.die2;
var dieIf = d.u.dieIf;
var die2If = d.u.die2If;
var bugIf = d.u.bugIf;


// ------- Export functions

// Shows all comments, which should have been hidden via the
// DebateHtml$ hideCommentsStyle, in html.scala.
// Only do this if the article itself is shown though.
debiki.v0.showInteractionsOnClick = function() {
  // Always show comments if the page body is not the root post.
  // (That is, if the article isn't shown, but a plain comment.
  // Otherwise people could create "fake" pages, by creating 
  // a comment and linking it with ?view=<comment-id> and it would
  // seem to be a page itself!)
  if ($('.dw-ar-p').length === 0) {  // article post not present?
    $('html').removeClass('dw-hide-interactions');
    return;
  }

  var numComments = $('.dw-p').length - 1;  // don't count the article
  if ($('.dw-p-ttl').length) numComments -= 1; // don't count article title
  var text = numComments > 1 ?  'Visa '+ numComments +' kommentarer' : // i18n
     (numComments == 1 ?  'Visa 1 kommentar' : 'Lämna en kommentar');
  var $showBtn = $(
      '<div class="dw-as dw-hor-a">' +
      '<a class="dw-a dw-a-show-interactions"></a></div>');
  $showBtn.find('a')
      .text(text)  // xss safe
      .css('font-size', '80%')
      .end()
      .insertBefore('.dw-ar-t > .dw-res')
      .click(function() {
    $showBtn.remove();
    $('html').removeClass('dw-hide-interactions');
    SVG.drawEverything(); // *sometimes* needed
  });
};

d.i.showInteractionsIfHidden = function() {
  // If they're hidden, there's a button that shows them.
  $('.dw-a-show-interactions').click();
}


// ------- Variables

// Debiki convention: Dialog elem tabindexes should vary from 101 to 109.
// HTML generation code assumes this, too. See Debiki for Developers, #7bZG31.
var DEBIKI_TABINDEX_DIALOG_MAX = 109;

var didResize = false;

var hostAndPort = location.origin.replace(/https?:\/\//, '');

var rootPostId = $('.dw-depth-0');
rootPostId = rootPostId.length ?
    rootPostId.attr('id').substr(5) : undefined; // drops initial `dw-t-'

// If there's no SVG support, we'll use images instead.
var nativeSvgSupport = Modernizr.inlinesvg;

var SVG = nativeSvgSupport && document.URL.indexOf('svg=false') === -1 ?
    d.i.makeSvgDrawer($) : d.i.makeFakeDrawer($);

var Me = d.i.makeCurUser();




// ------- Traversing etcetera

function findPostHeader$(postId) {
  return $('#post-'+ postId +' > .dw-p-hd');
}

jQuery.fn.dwPostId = function() {
  // Drop initial "post-".
  return this.dwCheckIs('.dw-p').attr('id').substr(5, 999);
};

jQuery.fn.dwPostFindHeader = function() {
  return this.dwCheckIs('.dw-p').children('.dw-p-hd');
};

jQuery.fn.dwPostHeaderFindStats = function() {
  return this.dwCheckIs('.dw-p-hd').children('.dw-p-flgs-all, .dw-p-r-all');
};

jQuery.fn.dwPostHeaderFindExactTimes = function() {
  return this.dwCheckIs('.dw-p-hd')
      .find('> .dw-p-at, > .dw-p-hd-e > .dw-p-at');
};

jQuery.fn.dwLastChange = function() {
  var maxDate = '0';
  this.dwCheckIs('.dw-p')
      .children('.dw-p-hd').find('.dw-date').each(function(){
    var date = jQuery(this).attr('title'); // creation or last modification date
    if (date > maxDate)
      maxDate = date;
  });
  return maxDate;
};

// The user id of the author of a post.
jQuery.fn.dwAuthorId = function() {
  var uid = this.dwCheckIs('.dw-p')
      .find('> .dw-p-hd > .dw-p-by').attr('data-dw-u-id');
  return uid;
};

// The root post need not be the article (if ?view=something-else specified).
$.fn.dwIsRootPost = function() {
  return this.dwCheckIs('.dw-p').parent().is('.dw-depth-0');
}

$.fn.dwIsArticlePost = function() {
  return this.dwCheckIs('.dw-p').is('.dw-ar-p');
}

$.fn.dwIsReply = function() {
  // 1 char IDs are reserved (1 is page body, 2 title, 3 template).
  var id = this.dwPostId();
  return id.length > 1;
}

$.fn.dwIsUnauReply = function() {
  var isReply = this.dwIsReply();
  // Unauthenticated users have '-' in their user ids.
  var unauAuthor = this.dwAuthorId().indexOf('-') !== -1;
  return isReply && unauAuthor;
}


// ------- Open/close


function $threadToggleFolded() {
  // In case the thread will be wider than the summary, prevent float drop.
  resizeRootThreadExtraWide();
  var $thread = $(this).closest('.dw-t');
  // Don't hide the toggle-folded-link and arrows pointing *to* this thread.
  var $childrenToFold = $thread.children(':not(.dw-z, .dw-arw)');
  var $foldLink = $thread.children('.dw-z');
  // {{{ COULD make the animation somewhat smoother, by sliting up the
  // thread only until it's as high as the <a> and then hide it and add
  // .dw-zd, because otherwie when the <a>'s position changes from absolute
  // to static, the thread height suddenly changes from 0 to the highht
  // of the <a>). }}}
  if ($thread.is('.dw-zd')) {
    // Thread is folded, open it.
    $childrenToFold.each(d.i.$slideDown);
    $thread.removeClass('dw-zd');
    $foldLink.text('[–]'); // not a '-', but an en dash, \u2013,
  } else {
    // Fold thread.
    var postCount = $thread.find('.dw-p').length;
    $childrenToFold.each(d.i.$slideUp).queue(function(next) {
      $foldLink.text('[+] Click to show '+  // COULD add i18n
          postCount +' posts');
      $thread.addClass('dw-zd');
      next();
    });
  }
  return false; // don't follow any <a> link
}


// ------- Outlining

// Outline new posts
/*
(function(){
  var myLastVersion = $.cookie('myLastPageVersion'); // cookie no longer exists
  if (!myLastVersion) return;
  var newPosts = posts.filter(function(index){ // BUG?…
    //… relied on posts = $('.debiki .dw-p-bd') but use '*.dw-p' instead?
    return $(this).dwLastChange() > myLastVersion;
  })
  newPosts.closest('.dw-t').addClass('dw-m-t-new');
  // TODO: sometimes .dw-m-p-edited instead of -new
})()
*/


/**
 * Highlights and outlines $tag, for a little while. If there're opaque
 * elems inside, you can list them in the `opt_backgroundSelector`
 * and then background highlighting is placed on them instead of on $tag.
 */
function highlightBriefly($tag, opt_backgroundSelector) {
  var duration = 2500;
  var $background = opt_backgroundSelector ?
      $tag.find(opt_backgroundSelector) : $tag;
  $background.effect('highlight',
      { easing: 'easeInExpo', color: 'yellow' }, duration);
  $tag.css('outline', 'solid thick #f0a005');
  // Remove the outline quickly (during 500 ms). Otherwise it looks
  // jerky: removing 1px at a time, slowly, is very noticeable!
  setTimeout(function() {
    $tag.animate({ outlineWidth: '0px' }, 400);
  }, Math.max(duration - 550, 0));
  /// This won't work, jQuery plugin doesn't support rgba animation:
  //$post.animate(
  //    { outlineColor: 'rgba(255, 0, 0, .5)' }, duration, 'easeInExpo');
  /// There's a rgba color support plugin though:
  /// http://pioupioum.fr/sandbox/jquery-color/
}


/**
 * Scrolls to `this`, then highlights `$tag`.
 */
jQuery.fn.dwScrollToThenHighlight = function($tag, options) {
  this.dwScrollIntoView(options).queue(function(next) {
    highlightBriefly($tag);
    next();
  });
  return this;
};


/**
 * Scrolls to and highlights `this`.
 */
jQuery.fn.dwScrollToHighlighted = function(options) {
  return this.dwScrollToThenHighlight(this);
};


function showAndHighlightPost($post, options) {
  $post.dwScrollIntoView(options).queue(function(next) {
    highlightBriefly($post, '.dw-p-bd, .dw-p-hd');
    next();
  });
}


function scrollToUrlAnchorPost() {
  var $anchorPost = $(location.hash).filter('.dw-p');
  if (!$anchorPost.length) return;
  showAndHighlightPost($anchorPost, { marginRight: 200, marginBottom: 300 });
  $anchorPost.parent().addClass('dw-m-t-new');  // outlines it
}


// Adds class 'debiki-current-site-section' to the navigation
// menu link that matches the current window.location.
// However, unless you are on the home page, links to the home page
// (which is assumed to be '/') are ignored, because *everything* is below
// the homepage, so homepage links would otherwise always be marked.
function showCurLocationInSiteNav() {
  function $isCurSectionLink() {
    var link = $(this).attr('href');
    var linkPathStart =
      link.search('https?://') === 0 ? link.indexOf('/', 8) : 0;
    // Same protocol, host and port, a.k.a. origin?
    var linkOrigin = link.substr(0, linkPathStart);
    if (linkOrigin.length !== 0 && linkOrigin !== location.origin)
      return false;
    // Exact path match? (include home page links)
    var linkPath = link.substr(linkPathStart);
    if (linkPath === location.pathname)
      return true;
    // Ignore links to the home page.
    if (linkPath === '/')
      return false;
    // Ignore links with query string or hash parts.
    // {{{ Then I can include in the site <nav> links to a certain
    // Subscribe part of my homepage ,without that link being
    // considered a separate site section. }}}
    if (linkPath.search(/[?#]/) !== -1)
      return false;
    // Does `location' start with `linkPath'?
    // But ingore any page name part of `linkPath'. Only folder paths
    // constitute site sections, I've decided.
    // {{{ So you can have <nav> links like this one: site/folder/path/-<guid>,
    // that is, reference the section "index" page via guid,
    // so redirects will work, should you redesign your site and
    // move sections elsewhere (to site/another/path/-<but-same-guid>). }}}
    var linkFolderPath = linkPath.substr(0, linkPath.lastIndexOf('/') + 1);
    var locStartsWithLink = location.pathname.search(linkFolderPath) === 0;
    return locStartsWithLink;
  }

  $('.debiki-0-mark-current-site-section a[href]')
      .filter($isCurSectionLink)
      .addClass('debiki-0-current-site-section');
}



// ------- Resizing


// Makes the root thread wide enough to contain all its child posts.
// Unless this is done e.g. when child posts are resized or stacked eastwards,
// or a reply/rate/edit form is shown/resized, the east-most threads
// will float-drop below the other threads.
// Had IE7 supported display: table-cell, none of this would have been needed?
function resizeRootThreadImpl(extraWidth) {
  // Let the root thead, which floats: left, expand eastwards as much as
  // it needs to — by making its parent very very wide.
  var $rootThread = $('.dw-depth-0');
  var $parent = $rootThread.parent();
  $parent.width(200200);

  // Now check how wide the parent actually needs to be, to prevent the
  // eastmost root post child threads from float dropping.
  // Also add 200px, because when you zoom in and out the width of
  // the root post might change a few pixels (this caused float
  // drop in Opera, at least before I started calling resizeRootThread
  // on zoom in/out).
  // {{{ Old comment
  // If a user drag-resizes a form quicker than this amount of pixels
  // per browser refresh, div-drop might happen anyway, because
  // this function isn't invoked until after the
  // browser has decided to float-drop the divs?
  // Also, zooming in/out might cause float drop (it seems all elems
  // aren't scaled exactly in the same way), if too small.
  // Hence it's a rather wide value. (Otherwise = 50 would do.)
  // }}}
  $rootThread.width('auto'); // cancel below bug workaround
  var requiredWidth = $rootThread.width();
  // Change from 2200:200 to 2700:700. 200 causes float drop, if
  // browser window is narrow, and you add a root post reply (why!?).
  $parent.width(requiredWidth + (extraWidth ? 2700 : 700));

  // Browser (?) bug workaround:
  // Oddly enough, in very very few situations, the browser (Chrome v19)
  // resizes $rootThread so the last <li> actually float drops! However
  // if I add just 10px to that $rootThread.width(), then there is no
  // more float drop (so it seems to me that the browser does a 10px error
  // — if the browser didn't attempt to avoid float drop at all,
  // adding 10px wouldn't suffice? A thread <li> is perhaps 200px wide.)
  // However, after adding 100px here, I've never observed any more
  // float drop.
  // This also requires us to add 100px in debiki.css, see [3krdi2].
  $rootThread.width(requiredWidth + 100);
}


// Makes the root thread wide enough to contain all its child posts.
// Is this not done e.g. when child posts are resized or stacked eastwards,
// or a reply/rate/edit form is shown/resized, the east-most threads
// will float-drop below the other threads.
function resizeRootThread() {
  resizeRootThreadImpl();
}

// Resizes the root thread so it becomes extra wide.
// This almost avoids all float drops, when quickly resizing an element
// (making it larger).
function resizeRootThreadExtraWide() {
  resizeRootThreadImpl(true);
}

// After an elem has been resized, the root thread is resized by
// a call to resizeRootThread(). However, it seems the browser
// (Google Chrome) calls that function before all elements
// are in their final position, in some weird manner, causing
// floats to drop, as if resizeRootThread() had not been called.
// This can be fixed by calling resizeRootThread() again,
// after a while when the browser is (probably) done
// doing its layout stuff.
var resizeRootThreadNowAndLater = (function(){
  var handle;
  return function() {
    resizeRootThread();
    if (handle) clearTimeout(handle);
    handle = setTimeout(resizeRootThread, 1500);
  };
}());

// Makes [threads layed out vertically] horizontally resizable.
function $makeEastResizable() {
  $(this).resizable({
    resize: function() {
      resizeRootThreadExtraWide();
      SVG.$drawParentsAndTree.apply(this);
    },
    handles: 'e',
    stop: function(event, ui) {
      // jQuery has added `height: ...' to the thread's style attribute.
      // Unless removed, the therad won't resize itself when child
      // threads are opened/closed.
      $(this).css('height', '');
      resizeRootThreadNowAndLater();
    }
  });
}


// ------- Posts


// Inits a post and its parent thread.
// Makes posts resizable, activates mouseenter/leave functionality,
// draws arrows to child threads, etc.
// Initing a thread is done in 4 steps. This function calls all those 4 steps.
// (The initialization is split into steps, so everything need not be done
// at once on page load.)
// Call on posts.
function $initPostsThread() {
  $initPostsThreadStep1.apply(this);
  $initPostsThreadStep2.apply(this);
  $initPostsThreadStep3.apply(this);
  $initPostsThreadStep4.apply(this);
}

function $initPostsThreadStep1() {
  var $thread = $(this).closest('.dw-t');

  // Find or add action buttons.
  var $actions = $thread.children('.dw-res').children('.dw-p-as');
  if ($actions.length) {
    // This thread is laid out horizontally and the action links have
    // already been placed somewhere in the child thread <ol>.
  } else {
    $actions = $('#dw-action-menu')
        .clone()
        .removeAttr('id')
        .css('visibility', 'hidden');
    $thread.find('> .dw-as').replaceWith($actions);
    // Touch devices cannot show-on-mouse-hover.
    if (Modernizr.touch)
      $actions.children('.dw-a-reply, .dw-a-rate')
          .css('visibility', 'visible');
  }

  // {{{ On delegating events for reply/rate/edit.
  // Placing a jQuery delegate on e.g. .debiki instead, entails that
  // these links are given excessively low precedence on Android:
  // on a screen touch, any <a> nearby that has a real click event
  // is clicked instead of the <a> with a delegate event. The reply/
  // reply/rate/edit links becomes virtually unclickable (if event
  // delegation is used instead). }}}
  $actions.children('.dw-a-reply').click(d.i.$showReplyForm);
  $actions.children('.dw-a-rate').click(d.i.$showRatingForm);
  $actions.children('.dw-a-more').click(function() {
    $(this).closest('.dw-p-as').find('.dw-a')
        .show()
        .end().end().remove();
  });
  //$actions.children('.dw-a-link').click($showLinkForm); — not implemented
  $actions.children('.dw-a-edit').click(d.i.$showEditsDialog);
  $actions.children('.dw-a-flag').click(d.i.$showFlagForm);
  $actions.children('.dw-a-delete').click(d.i.$showDeleteForm);

  // Open/close threads if the fold link is clicked.
  $thread.children('.dw-z').click($threadToggleFolded);
}

// Things that can be done a while after page load.
function $initPostsThreadStep2() {
  var $thread = $(this).closest('.dw-t');
  var $post = $thread.filter(':not(.dw-depth-0)').children('.dw-p');

  // When hovering a post, show actions, and make it resizable.
  // But always show the leftmost Reply, at depth-0, that creates a new column.
  // (Better avoid delegates for frequent events such as mouseenter.)
  $post.mouseenter(function() {
    var $i = $(this);

    // If actions are already shown for an inline child post, ignore event.
    // (Sometimes the mouseenter event is fired first for an inline child
    // post, then for its parent — and then actions should be shown for the
    // child post; the parent should ignore the event.)
    var inlineChildActionsShown = $i.find('#dw-p-as-shown').length;

    // If the post is being edited, show no actions.
    // (It's rather confusing to be able to Reply to the edit <form>.)
    var isBeingEdited = $i.children('.dw-f-e:visible').length;

    if (isBeingEdited)
      d.i.hideActions();
    else if (!inlineChildActionsShown)
      $i.each(d.i.$showActions);
    // else leave actions visible, below the inline child post.
  });

  $thread.mouseleave(function() {
    // If this is an inline post, show the action menu for the parent post
    // since we're hovering that post now.
    $(this).closest('.dw-p').each(d.i.$showActions);
  });

  $initPostStep1.apply(this);
}

function $initPostsThreadStep3() {
  $initPostStep2.apply(this);
}

function $initPostsThreadStep4() {
  var $thread = $(this).closest('.dw-t');

  // Make replies to the root thread resizable horizontally. (Takes
  // perhaps 100 ms on my 6 core 2.8 GHz AMD, 24 depth-1 reply columns.)
  // (But skip inline replies; they expand eastwards regardless.)
  // $makeEastResizable must be called before $makePostResizable (not in
  // use though!), or $makeEastResizable has no effect. No idea
  // why -- my guess is some jQuery code does something similar to
  // `$.find(..)', and finds the wrong resizable stuff,
  // if the *inner* tag is made resizable before the *outer* tag.
  //
  // However for touch devises, don't enable resizing of posts: it doesn't
  // work, and the resize handles steal touch events from buttons nearby.
  if (!Modernizr.touch)
    $thread.filter(function() {
      var $i = $(this);
      return !$i.is('.dw-i-t') && $i.parent().closest('.dw-t').is('.dw-hor');
    }).each($makeEastResizable);

  showCurLocationInSiteNav();
}

// Inits a post, not its parent thread.
function $initPost() {
  $initPostStep1.apply(this);
  $initPostStep2.apply(this);
}

function $initPostStep1() {
  var $i = $(this),
      $hdr = $i.find('.dw-p-hd'),
      $postedAt = $hdr.children('.dw-p-at'),
      postedAtTitle = $postedAt.attr('title'),
      postedAt = d.u.isoDateToMillis(postedAtTitle),
      $editedAt = $hdr.find('> .dw-p-hd-e > .dw-p-at'),
      editedAtTitle = $editedAt.attr('title'),
      editedAt = d.u.isoDateToMillis(editedAtTitle),
      now = new Date();  // COULD cache? e.g. when initing all posts

  // If this post has any inline thread, place inline marks and split
  // the single .dw-p-bd-blk into many blocks with inline threads
  // inbetween.
  // (This takes rather long (120 ms for 110 posts, of which 20 are inlined,
  // on my 6 core 2.8 GHz AMD) but should nevertheless be done quite early,
  // because it rearranges threads and posts, and that'd better not happen
  // after a while when the user thinks the page has already finished
  // loading.)
  if ($i.parent().children('.dw-res').children('.dw-i-t').length) {
    $i.each(d.i.$placeInlineMarks)
      .each(d.i.$splitBodyPlaceInlines);
  }

  function timeAgoAbbr(title, then, now) {
    return $('<abbr title="'+ title +'">'+ d.u.prettyTimeBetween(then, now) +
        '</abbr>');
  };

  // Show pretty how-long-ago info. (The $posted/editedAt are already hidden.)
  $postedAt.before(timeAgoAbbr(postedAtTitle, postedAt, now));
  $editedAt.before(timeAgoAbbr(editedAtTitle, editedAt, now));

  // If you clicks the header, show detailed rating and flags info.
  // If you click again, show exact creation date and edit date.
  // On a third click, hide everything again.
  if ($hdr.dwPostHeaderFindStats().length
      ) $hdr.css('cursor', 'help').click(function(event) {
    if ($(event.target).is('a'))
      return;  // don't expand header on link click
    var $i = $(this);
    var $stats = $i.dwPostHeaderFindStats();
    var $times = $i.dwPostHeaderFindExactTimes();
    if ($stats.is(':hidden')) {
      $stats.show();
    }
    /// Skip this for now, rewrite so dates are appended, don't
    /// insert in the middle.
    // else if ($times.is(':hidden')) {
    //  $times.show();
    else {
      $times.hide();
      $stats.hide();
    }
    // This might have expanded the post, so redraw arrows.
    $i.closest('.dw-p').each(SVG.$drawParents);
  });

  d.i.$highlightInlinesOnHover.call(this);
}

function $initPostStep2() {
  // $initPostSvg takes rather long (190 ms on my 6 core 2.8 GHz AMD, for
  // 100 posts), and  need not be done until just before SVG is drawn.
  SVG.$initPostSvg.apply(this);
}



// -------


function confirmClosePage() {
  // If there're any reply forms with non-empty replies (textareas),
  // or any edit forms, then return a confirm close message.
  // (COULD avoid counting unchanged edits too.)
  // Count only :visible forms — non-visible forms are 1) hidden template
  // forms and 2) forms the user has closed. They aren't removed, because
  // it's nice to have your text reappear should you accidentally close
  // a form, but open it again.
  var replyCount = $('.dw-fs-re:visible').filter(function() {
    return $(this).find('textarea').val().length > 0;
  }).length;
  var editCount = $('.dw-f-e:visible').length;
  var msg = replyCount + editCount > 0 ?  // i18n
    'You have started writing but not saved your work. Really close page?' :
    undefined;  // don't return null, or IE asks roughly `confirm null?'
  return msg;
}



// ------- Utterscroll and Tooltips


function initUtterscroll() {
  bugIf(Modernizr.touch);
  // Activate Utterscroll, and show tips if people use the window scrollbars,
  // hide it on utterscroll.
  var hasUtterscrolled = false;
  var $utterscrollTips;
  debiki.Utterscroll.enable({
    scrollstoppers: '.CodeMirror,'+
        ' .ui-draggable, .ui-resizable-handle, .dw-p-hd',
    onMousedownOnWinHztlScrollbar: function() {
      if (hasUtterscrolled || $utterscrollTips)
        return;
      var $tips = $('#dw-tps-utterscroll');
      $tips.show()
          // Place tips in the middle of the viewport.
          // (The tips has position: fixed.)
          .css('top', ($(window).height() - $tips.height()) / 2)
          .css('left', ($(window).width() - $tips.width()) / 2)
          .click(function() { $tips.hide(); });
      $utterscrollTips = $tips;
    },
    onHasUtterscrolled: function() {
      hasUtterscrolled = true;
      if ($utterscrollTips) $utterscrollTips.hide();
    }
  });
}


function $makePostHeadTooltips() {  // i18n
  if (!$.fn.tooltip) return; // tooltips not loaded
  var $postHead = $(this);
  if ($postHead.find('[data-original-title]').length)
    return; // tooltips already added

  // Tooltips explaining '?' and '??' login type indicators.
  $postHead.find('.dw-lg-t-spl').each(function() {
    var tip;
    var $i = $(this);
    if ($i.text() == '??') {
      tip = '<b>??</b> means that the user has not logged in,'+
          ' so <i>anyone</i> can pretend to be this user&nbsp;(!),'+
          ' and not specified any email address.'
      // better?: does not receive email notifications.'
    }
    else if ($i.text() == '?') {
      tip = '<b>?</b> means that the user has not logged in,'+
          ' so <i>anyone</i> can pretend to be this user&nbsp;(!),'+
          ' but has specified an email address.'
        // and receives email notifications.'
    }
    else die();
    $i.tooltip({
      title: tip,
      placement: 'right' // or '?' cursor hides tooltip arrow
    });
  });
}



// ------- Initialization functions


function registerEventHandlersFireLoginOut() {

  // COULD move to debiki-login.js
  $('#dw-a-login').click(d.i.showLoginSimple);
  $('#dw-a-logout').click(d.i.showLogout);

  // On post text click, open the inline action menu.
  // But hide it on mousedown, so the inline action menu disappears when you
  // start the 2nd click of a double click, and appears first when the 2nd
  // click is completed. Otherwise the inline menu gets in the
  // way when you double click to select whole words. (Or triple click to
  // select paragraphs.)
  // COULD move to debiki-actions-inline.js
  $('.debiki').delegate('.dw-p-bd-blk', 'mouseup', d.i.$showInlineActionMenu)
      .delegate('.dw-p-bd-blk', 'mousedown', d.i.$hideInlineActionMenu);

  // Remove new-reply and rating forms on cancel, but 
  // the edit form has some own special logic.
  $('.debiki').delegate(
      '.dw-fs-re .dw-fi-cancel, ' +
      '.dw-fs-r .dw-fi-cancel',
      'click', d.i.$removeClosestForms);

  // Show the related inline reply, on inline mark click.
  // COULD move to debiki-inline-threds.js
  $('.debiki').delegate('a.dw-i-m-start', 'click', d.i.$showInlineReply);

  // Add tooltips lazily.
  $('.debiki').delegate('.dw-p-hd', 'mouseenter', $makePostHeadTooltips);


  window.onbeforeunload = confirmClosePage;

  // Hide all action forms, since they will be slided in.
  $('#dw-hidden-templates .dw-fs').hide();

  // Show a change diff instead of the post text, when hovering an edit
  // suggestion.
  // SHOULD move this init code to debiki-edit-history.js
  $('.debiki')
      .delegate('.dw-e-sg', 'mouseenter', function(){
        // COULD move find(...) to inside $showEditDiff?
        // (Don't want such logic placed down here.)
        // SHOULD move this to debiki-action-edit.js?
        $(this).find('.dw-e-text').each(d.i.$showEditDiff);
      })
      .delegate('.dw-e-sgs', 'mouseleave', d.i.$removeEditDiff);

  // Fire the dwEvLoggedInOut event, so all buttons etc will update
  // their text with the correct user name.
  // {{{ Details:
  // Firing the dwEvLoggedInOut event causes the user name to be updated
  // to the name of the logged in user, everywhere. This needs to be done
  // in JavaScript, cannot be done only server side — because when the user
  // logs in/out using JavaScript, and uses the browser's *back* button to
  // return to an earlier page, that page might not be fetched again
  // from the server, but this javascript code updates the page to take
  // into account that the user name (and related cookies) has changed
  // (since the user logged in/out).
  // Do this when everything has been inited, so all dwEvLoggedInOut event
  // listeners have been registered. }}}

  // COULD move this to debiki-login.js
  $('.dw-loginsubmit-on-click').click(d.i.$loginThenSubmit);

  if (d.i.Me.isLoggedIn()) d.i.Me.fireLogin();
  else d.i.Me.fireLogout();

  // If the user switches browser tab, s/he might logout and login
  // in another tab. That'd invalidate all xsrf tokens on this page,
  // and user specific permissions and ratings info (for this tab).
  // Therefore, when the user switches back to this tab, check
  // if a new session has been started.
  $(window).on('focus', d.i.Me.fireLoginIfNewSession);
  //{{{ What will work w/ IE?
  // See http://stackoverflow.com/a/5556858/694469
  // But: "This script breaks down in IE(8) when you have a textarea on the
  // page.  When you click on the textarea, the document and window both
  // lose focus"
  //// IE EVENTS
  //$(document).bind('focusin', function(){
  //    alert('document focusin');
  //});
  //if (/*@cc_on!@*/false) { // check for Internet Explorer
  //  document.onfocusin = onFocus;
  //  document.onfocusout = onBlur;
  //} else {
  //  window.onfocus = onFocus;
  //  window.onblur = onBlur;
  //}
  //
  // http://stackoverflow.com/a/6184276/694469
  //window.addEventListener('focus', function() {
  //  document.title = 'focused';
  //});
  //window.addEventListener('blur', function() {
  //    document.title = 'not focused';
  //});
  //}}}
}


function initAndDrawSvg() {
  // Don't draw SVG until all html tags has been placed, or the SVG
  // arrows might be offset incorrectly.
  // Actually, drawing SVG takes long, so wait for a while,
  // don't do it on page load.
  SVG.initRootSvg();
  SVG.drawEverything();
}


// ------- Actually render the page

// Render the page step by step, to reduce page loading time. (When the first
// step is done, the user should conceive the page as mostly loaded.)

function renderPageEtc() {
  var $posts = $('.debiki .dw-p:not(.dw-p-ttl)');
  function initPostsThreadStep1() {
    $posts.each($initPostsThreadStep1);
    $('html').removeClass('dw-render-actions-pending');
  }
  function initPostsThreadStep2() { $posts.each($initPostsThreadStep2) }
  function initPostsThreadStep3() { $posts.each($initPostsThreadStep3) }
  function initPostsThreadStep4() { $posts.each($initPostsThreadStep4) }

  (d.u.workAroundAndroidZoomBug || function() {})($);

  // IE 6, 7 and 8 specific elems (e.g. upgrade-to-newer-browser info)
  // (Could do this on the server instead, that'd work also with Javascript
  // disabled. But people who know what javascript is and disable it,
  // probably don't use IE 6 and 7? So this'll be fine for now.)
  var $body =  $('body');
  if ($.browser.msie) {
    if ($.browser.version < '8') $body.addClass('dw-ua-lte-ie7');
    if ($.browser.version < '9') $body.addClass('dw-ua-lte-ie8');
  }

  Me.refreshProps();

  // When you zoom in or out, the width of the root thread might change
  // a few pixels — then its parent should be resized so the root
  // thread fits inside with no float drop.
  d.u.zoomListeners.push(resizeRootThread);

  var steps = [];
  steps.push(initPostsThreadStep1);
  steps.push(initPostsThreadStep2);
  steps.push(initPostsThreadStep3);
  // COULD fire login earlier; it's confusing that the 'Login' link
  // is visible for rather long, when you load a *huge* page.
  steps.push(registerEventHandlersFireLoginOut);
  steps.push(initPostsThreadStep4);
  steps.push(initAndDrawSvg);
  steps.push(scrollToUrlAnchorPost);
  // Resize the article, now when the page has been rendered, and all inline
  // threads have been placed and can be taken into account.
  steps.push(function() {
    resizeRootThread();
    $('html').removeClass('dw-render-layout-pending');
    debiki.scriptLoad.resolve();
  });
  if (!Modernizr.touch) steps.push(function() {
    d.i.initKeybdShortcuts($);
    initUtterscroll();
  });

  function runNextStep() {
    steps[0]();
    steps.shift();
    if (steps.length > 0)
      setTimeout(runNextStep, 70);
  }

  setTimeout(runNextStep, 60);
}


// Export stuff.
d.i.$initPostsThread = $initPostsThread;
d.i.$initPost = $initPost;
d.i.DEBIKI_TABINDEX_DIALOG_MAX = DEBIKI_TABINDEX_DIALOG_MAX;
d.i.findPostHeader$ = findPostHeader$;
d.i.hostAndPort = hostAndPort;
d.i.Me = Me;
d.i.resizeRootThread = resizeRootThread;
d.i.resizeRootThreadExtraWide = resizeRootThreadExtraWide;
d.i.resizeRootThreadNowAndLater = resizeRootThreadNowAndLater;
d.i.SVG = SVG;
d.i.rootPostId = rootPostId;
d.i.showAndHighlightPost = showAndHighlightPost;


// Dont render page, if there is no root post, or some error happens,
// which kills other Javascript that runs on page load.
if (rootPostId) renderPageEtc();


//----------------------------------------
   }); // end jQuery onload
//----------------------------------------
//========================================
   }()); // end Debiki module
//========================================


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
