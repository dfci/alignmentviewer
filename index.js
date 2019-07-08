var msa; // msa obj created by seqlib.js
var msaTextblockWidth;
var d3StatsPlots;
var d3PairwiseIdentityPlot;
var d3fg; // d3 force-directed graph
var pwGraph; // pairwise identity graph object
var pwMap; // pairwise map plot object
var pwMapNSeq;
var msaImage;
var msaImgColorType = 1; // 1:mview, 2:hydrophobicity, 3:mutations
var drawImageNSeq;
var asyncTimeout = 2; // ms
var msaImageTimeout = 1; //original at 10
var colorSliderDflt = 0;
var imageSliderDflt = { w: 4, h: 4 };
var filterGaps = 100; // default filtering values (=no filtering)
var filterIdent = 0;
var filterRSgaps = false;
var msaPage = 0;
var firstSequence = '';

// Read URL query parameters
var getUrlParameter = function(sParam) {
  var sPageURL = window.location.search.substring(1);
  var sURLVariables = sPageURL.split('&');
  var sParameterName = '';
  for (let i = 0; i < sURLVariables.length; i++) {
    sParameterName = sURLVariables[i].split('=');

    if (sParameterName[0] === sParam) {
      return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
    }
  }
};

// _________________________________________________________________________________________________________________________________

var btn2view = {
  btn1: '#ABTview',
  btn2: '#MSAview',
  btn3: '#STAview',
  btn4: '#IMGview',
  btn5: '#DATview',
  btn6: '#SPEview',
  btn7: '#couplings',
};

$(document).ready(function() {
  // some say this works for FF and Chrome only so we're providing FILE input control as well
  document.documentElement.ondragover = function() {
    return false;
  };
  document.documentElement.ondragend = function() {
    return false;
  };
  document.documentElement.ondrop = handleFileSelect;
  document.getElementById('files').addEventListener('change', handleFileSelect, false);
  document.getElementById('customdata').addEventListener('change', handleCustomFileSelect, false);
  document.getElementById('customdata2').addEventListener('change', handleCustomFileSelectCouplings, false);

  // on-click computing pair-wise identity
  $('#pairwise_start_btn').click(function(event) {
    msa.togglePairwiseIdentity();
  });

  var grapthSliderDflt = 0.7;
  $('#graphSlider').slider({
    max: 1,
    min: 0,
    step: 0.01,
    value: grapthSliderDflt,
    slide: function(event, ui) {
      $('#graphSliderVal').html(ui.value);
    },
  });
  $('#graphSliderVal').html(grapthSliderDflt);

  // --- jQuery is awesome -------------
  $('[id^=btn]').click(function(event) {
    var view = btn2view[event.target.id]; // button id --> view id
    if ($(view).is(':visible')) {
      return;
    } // already active, do nothing
    $('[id$=view]')
      .not(view)
      .hide(); // select all views except current, hide
    $(view).show(); // show current
    $(event.target)
      .removeClass('btnReleased')
      .addClass('btnPressed');
    $('[id^=btn]')
      .not(event.target)
      .removeClass('btnPressed')
      .addClass('btnReleased');
  });

  $('#order').change(reloadMSA);

  $('#graphApply')
    .button()
    .click(function() {
      if (d3fg) {
        d3fg.clear();
      }
      initForceGraph();
    })
    .prop('disabled', false)
    .button('refresh');

  $('#graphClear')
    .button()
    .click(function() {
      if (d3fg) {
        d3fg.clear();
      }
    })
    .prop('disabled', false)
    .button('refresh');

  $('#colorSlider').slider({
    max: 1,
    min: 0,
    step: 0.01,
    value: colorSliderDflt,
    slide: function(event, ui) {
      $('#colorSliderVal').html(ui.value);
      msa.setColorThresh(ui.value);
    },
  });
  $('#colorSliderVal').html(colorSliderDflt);
  $('#colorApply')
    .button()
    .click(reloadMSA);

  // --- filtering --------------------------

  $('#sliderFilterIdent').slider({
    max: 100,
    min: 0,
    step: 1,
    value: filterIdent,
    slide: function(event, ui) {
      $('#sliderFilterIdentVal').html(ui.value + '%');
    },
  });
  $('#sliderFilterIdentVal').html(filterIdent + '%');

  $('#sliderFilterGaps').slider({
    max: 100,
    min: 0,
    step: 1,
    value: filterGaps,
    slide: function(event, ui) {
      $('#sliderFilterGapsVal').html(ui.value + '%');
    },
  });
  $('#sliderFilterGapsVal').html(filterGaps + '%');

  $('#CHKrfgaps').attr('checked', false);

  $('#filterStatus').html('');
  $('#filterApply')
    .button()
    .click(function() {
      filterGaps = $('#sliderFilterGaps').slider('option', 'value');
      filterIdent = $('#sliderFilterIdent').slider('option', 'value');
      filterRSgaps = $('#CHKrfgaps').is(':checked');
      var orderby = $('#order').val();
      msa.reRender(msaPage, orderby, filterGaps, filterIdent, filterRSgaps);
    });
  $('#filterExport')
    .button()
    .click(function() {
      var valGaps = $('#sliderFilterGaps').slider('option', 'value');
      var valIdent = $('#sliderFilterIdent').slider('option', 'value');
      var varRSgaps = $('#CHKrfgaps').is(':checked');
      msa.applyExport(valGaps, valIdent, false);
    });

  // image view controls -----------------------
  $('#imageApply')
    .button()
    .click(drawMsaImage);
  $('#imageResidWSlider').slider({
    max: 10,
    min: 1,
    step: 1,
    value: imageSliderDflt.w,
    slide: function(event, ui) {
      $('#imageResidW').html(ui.value);
    },
  });
  $('#imageResidW').html(imageSliderDflt.w);
  $('#imageResidHSlider').slider({
    max: 10,
    min: 1,
    step: 1,
    value: imageSliderDflt.h,
    slide: function(event, ui) {
      $('#imageResidH').html(ui.value);
    },
  });
  $('#imageResidH').html(imageSliderDflt.h);

  // checkboxes to control annotation columns
  $('#CHKspecies').attr('checked', true);
  $('#CHKinfo').attr('checked', true);
  $('#CHKcustom').attr('checked', true);
  $('#CHKpfam').attr('checked', true);
  $('#CHKconservation').attr('checked', true);
  $('#CHKseqlogo').attr('checked', true);
  $('#CHKspecies').change(function() {
    $('[id^=MSAspecies]').toggle();
  });
  $('#CHKinfo').change(function() {
    $('[id^=MSAinfo]').toggle();
  });
  $('#CHKpfam').change(function() {
    $('[id^=MSApfam]').toggle();
  });
  $('#CHKcustom').change(function() {
    $('#MSAcustomA').toggle();
    $('#MSAcustomAH').toggle();
  });
  $('#CHKcustom').change(function() {
    $('#MSAcustomB').toggle();
    $('#MSAcustomBH').toggle();
  });
  $('#CHKconservation').change(function() {
    $('#labeled_plot_canvas').toggle();
  });
  $('#CHKseqlogo').change(function() {
    $('#seqlogo').toggle();
  });

  // Read MSA from URL
  var originURL = getUrlParameter('url');

  console.log(originURL);

  if (originURL !== undefined) {
    $('#progress')
      .show()
      .html('Fetching file...');
    $.get(originURL, function(data) {
      loadNewMSA(data);
    });
  }
});

// causes re-rendering of conservation_plot/ruler/msa sequence table
function forceMsaRerender() {
  // some web comments report that children must be rerendered explicitly rather than relying on cascade
  var plot_canvas = document.getElementById('plot_canvas');
  var seqlogo = document.getElementById('seqlogo');
  var ruler = document.getElementById('MSAruler');
  var seqs = document.getElementById('MSAseqs');
  var msatable = document.getElementById('MSAview');
  plot_canvas.style.display = 'none';
  seqlogo.style.display = 'none';
  ruler.style.display = 'none';
  seqs.style.display = 'none';
  plot_canvas.style.display = 'block';
  seqlogo.style.display = 'block';
  ruler.style.display = 'block';
  seqs.style.display = 'block';
  msatable.style.display = 'none';
  msatable.style.display = 'block';
}

// causes re-rendering of conservation plot and sequence logo if zoom causes change in MSA text width
function zoomEventWatchdog() {
  if (!$('#MSAview').is(':visible')) {
    return;
  }
  if (msaTextblockWidth === null) {
    return;
  }
  if (msaTextblockWidth === 0) {
    return;
  }
  if (Math.abs($('#MSAseqs').width() - msaTextblockWidth) > 5) {
    //	console.log('logo width reset:' + msaTextblockWidth + ' ' + $('#MSAseqs').width() + ' mismatch');
    $('#seqlogo').html('');
    $('#plot_canvas').html('');
    forceMsaRerender();
    msaTextblockWidth = $('#MSAseqs').width();
    var alignmentData = msa.getNormalizedColumnProportions();
    msa.redrawConservationPlot('#plot_canvas', msaTextblockWidth);
    var logoDiagram = new SequenceLogoDiagramD3(
      { elementId: 'seqlogo', elementWidth: msaTextblockWidth, elementHeight: 48 },
      alignmentData,
    );
    logoDiagram.initDiagram();
  }
}

// this gets called on msa reload only!
function switchToMsaView() {
  // clear entire msa html (12 divs) before switching to MSA view to avoid big pause for large alignments while old msa redraws
  $('#MSAnames').html('');
  $('#MSAinfo').html('');
  $('#MSAcustomA').html('');
  $('#MSAcustomB').html('');
  $('#MSAspecies').html('');
  $('#MSApfam').html('');
  $('#MSAident1').html('');
  $('#MSAident2').html('');
  $('#MSAgaps').html('');
  $('#MSArows').html('');
  $('#MSArows2').html('');
  $('#plot_canvas').html('');
  $('#seqlogo').html('');
  $('#MSAruler').html('');
  $('#MSAseqs').html('');
  forceMsaRerender();
  $('#STAview').hide();
  $('#IMGview').hide();
  $('#ABTview').hide();
  $('#DATview').hide();
  $('#couplings').hide();
  $('#SPEview').hide();
  $('#MSAview').show();
  // TODO: doable with one wildcard selector
  $('#btn1')
    .removeClass('btnPressed')
    .addClass('btnReleased');
  $('#btn2')
    .removeClass('btnReleased')
    .addClass('btnPressed');
  $('#btn3')
    .removeClass('btnPressed')
    .addClass('btnReleased');
  $('#btn4')
    .removeClass('btnPressed')
    .addClass('btnReleased');
  $('#btn5')
    .removeClass('btnPressed')
    .addClass('btnReleased');
  $('#btn6')
    .removeClass('btnPressed')
    .addClass('btnReleased');
  $('#btn7')
    .removeClass('btnPressed')
    .addClass('btnReleased');
}

// -------------------------------------------------------------------------- msa callbacks -------------

var msaCallback = {
  // msa reading callbacks

  progress: function(msg) {
    $('#progress').html(msg);
  },
  fail: function(msg) {
    $('#progress').html(msg);
  },
  doneReading: function(msg) {
    // msa fully parsed
    console.log('doneReading...');
    $('#MSAnames').html(msa.hnames);
    $('#MSAspecies').html(msa.hspecies);
    $('#MSAinfo').html(msa.hinfo);
    $('#MSAcustomA').html(msa.hcustomwA);
    $('#MSAcustomB').html(msa.hcustomwB);
    $('#MSApfam').html(msa.hpfam);
    $('#MSAident1').html(msa.hident1);
    $('#MSAident2').html(msa.hident2);
    $('#MSAgaps').html(msa.hgaps);
    $('#MSArows').html(msa.hrows);
    $('#MSArows2').html(msa.hrows2);
    $('#MSAseqs').html(msa.hseqs);
    $('#MSAruler').html(msa.hruler);
    $('#MSAview').show();
    msaTextblockWidth = null; // turn off zoom change watchdog
    if (msa.rerenderQ) {
      /*
                    // TODO: hiding gapping columns not working, comment out for now
                    //
                    // in case if msa width changes need to get a chance for dom to update before getting msa div width
                    setTimeout(function() {
                        var w = $('#MSAseqs').width();		// need to redraw plot in case columns got filtered out
                        msa.redrawConservationPlot('#plot_canvas', w);
                    }, 100);
                    */
      $('#progress').hide();
      return;
    }
    //	console.log('hnames=' + msa.hnames.length + ' hident=' + msa.hident1.length + ' hgaps=' + msa.hgaps.length +
    //				'hrows=' + msa.hrows.length + ' hseqs=' + msa.hseqs.length + ' hruler=' + msa.hruler.length);
    $('#progress').html('computing conservation...');
    setTimeout('msa.asyncComputeConservation()', msa.asyncTimeout);
    $('#buttons').show();
  },
  doneComputing: function(msg) {
    // top charts computed -- gaps and identity
    console.log('doneComputing .......');
    forceMsaRerender();
    msaTextblockWidth = $('#MSAseqs').width();
    var alignmentData = msa.getNormalizedColumnProportions();
    msa.redrawConservationPlot('#plot_canvas', msaTextblockWidth);
    var logoDiagram = new SequenceLogoDiagramD3(
      { elementId: 'seqlogo', elementWidth: msaTextblockWidth, elementHeight: 48 },
      alignmentData,
    );
    logoDiagram.initDiagram();
    setInterval(function() {
      zoomEventWatchdog();
    }, 1269);
    UpdateStatsPlot();
    UpdatePairwisePlot(); // this will clear pairwise plot on new msa loading
    resetMsaImage();
    UpdateSpeciesDiagram();
    if (msa.page.validQ) {
      $('#pagingCtrl').show();
      var np = msa.page.pages;
      var val = msa.page.getstr(msaPage) + ' out of ' + msa.h;
      // paging slider ------------------------------
      $('#sliderPage').slider({
        min: 1,
        max: np,
        step: 1,
        value: 1,
        slide: function(event, ui) {
          msaPage = ui.value - 1;
          var sliderPageVal = msa.page.getstr(msaPage) + ' out of ' + msa.h;
          $('#sliderPageVal').html(sliderPageVal);
        },
        stop: function(event, ui) {
          msaPage = ui.value - 1;
          reloadMSA();
        },
      });
      $('#sliderPageVal').html(val);
    } else {
      $('#pagingCtrl').hide();
    }
    $('#progress').hide();
  },
};

var msaPairwise = {
  // pairwise identity computation callback
  start: function() {
    $('#pairwise_status').html('');
    $('#pairwise_start_btn').html('cancel');
    $('#pairwise_start_btn').click(function(event) {
      $.proxy(msa.togglePairwiseIdentity, msa);
    });
  },
  progress: function(msg) {
    $('#pairwise_status').html(msg);
  },
  done: function(completeQ) {
    if (completeQ) {
      $('#pairwise_start_btn').html('');
      var txt = "<b><span class='tc2'>max</span>/<span class='tc1'>average</span>/<span class='tc0'>min</span></b> (sorted by ranking)";
      $('#pairwise_status').html(txt);
      $('#MSApairwise').removeClass('plot_border');
      UpdatePairwisePlot();
    } else {
      $('#pairwise_status').html(' (takes a while for large alignments)');
      $('#pairwise_start_btn').html('calculate');
      $('#pairwise_start_btn').click(function(event) {
        $.proxy(msa.togglePairwiseIdentity, msa);
      });
    }
  },
};

// ---------------------------------------------------------- global UI functions ---------------------

function reloadMSA() {
  $('#progress')
    .show()
    .html('updating html...');
  var orderby = $('#order').val();
  msa.reRender(msaPage, orderby, filterGaps, filterIdent, filterRSgaps);
}

function loadNewMSA(data) {
  console.log('loadNewMSA');
  $('#progress')
    .show()
    .html('updating html...');
  switchToMsaView();
  $('#pairwise_start_btn').html('calculate');
  $('#pairwise_start_btn').click(function(event) {
    $.proxy(msa.togglePairwiseIdentity, msa);
  });
  $('#pairwise_status').html(' (takes a while for large alignments)');
  $('[id^=inp_]').val('');
  $('#MSApairwise').addClass('plot_border');
  $('#colorSliderVal').html(colorSliderDflt);
  $('#colorSlider').slider('option', 'value', colorSliderDflt);
  $('#order').val('orderOrig');
  $('#customdata').val(''); // clear path in custom data file control
  $('#customdata2').val(''); // clear path in custom data file control
  $('#order option[value="orderCustomAW"]').remove(); // remove sorting option from msa order dropdown
  $('#order option[value="orderCustomBW"]').remove(); // remove sorting option from msa order dropdown
  $('#MSAcustomAH').text('');
  $('#MSAcustomBH').text('');
  var species = isset(speclist) ? speclist : false;
  if (!msa) {
    msa = createMSA(species);
  }
  msa.asyncRead(data, msaCallback, msaPairwise);
}

// --- pulling msa examples from the server --------------------------------------------------------------

var exmpUrl = '';
function PullMsaExample(which) {
  var url = exmpUrl;
  switch (which) {
    case 1:
      url += '/1bkr_A.1-108.msa.txt';
      break;
    case 2:
      url += '/MYG_PHYMC.1-154.msa.txt';
      break;
    case 3:
      url += '/EGFR_HUMAN.712-968.msa.txt';
      break;
    case 4:
      url += '/BLAT_ECOLX.1-286.msa.txt';
      break;
    default:
      return;
  }
  console.log(url);
  $.get(url, function(data) {
    loadNewMSA(data);
  });
}

// --- canvas --------------------------------------------------------------------------------------------

function drawMsaImage() {
  $('#msaImage').html('');
  var div = document.getElementById('msaImage');
  var ca = div.getContext('2d');
  msaImage = createMsaImageCanvas(div, ca);
  var currentFilteredSequenceCount = msa.h;
  var filteredSequenceOrder = msa.getCurrentFilteredSequenceOrder();
  if (filteredSequenceOrder != null) {
    currentFilteredSequenceCount = filteredSequenceOrder.length;
  }
  var rw = $('#imageResidW').text();
  var rh = $('#imageResidH').text();
  msaImgColorType = $('#msaImgClrSelect').val();
  msaImage.init(rw, rh, msa.w, currentFilteredSequenceCount);
  drawImageNSeq = 0;
  console.log('init msa image...');
  console.log(this.seqs);
  setTimeout('asyncDrawMsaImage()', 0); //0<-msaImageTimeout
}

function asyncDrawMsaImage() {
  var filteredSequenceOrder = msa.getCurrentFilteredSequenceOrder();
  if (filteredSequenceOrder == null || filteredSequenceOrder.length === 0) {
    return;
  }
  if (drawImageNSeq === filteredSequenceOrder.length) {
    return;
  }
  for (var col = 0; col < msa.w; col++) {
    var sequenceIndex = filteredSequenceOrder[drawImageNSeq];
    var aa = msa.seqs[sequenceIndex].charAt(col);
    if (aa === '.' || aa === '-') {
      continue;
    }

    if (msaImgColorType === 1) {
      clr = getResidColor('mview', aa);
    } else if (msaImgColorType === 2) {
      clr = getResidHydroColor(aa);
    } else if (msaImgColorType === 3) {
      clr = getResidColor('mview', aa);

      if (msa.seqs[sequenceIndex].charAt(col) === msa.seqs[0].charAt(col)) {
        //Reducing opacity instead of preventing any disply

        color = clr;
        percent = 0.9; //How much transparency 0-> full color; 1-> white

        //Applying the transparency layer to the obtained color
        var f = parseInt(color.slice(1), 16);
        var t = percent < 0 ? 0 : 255;
        var p = percent < 0 ? percent * -1 : percent;
        // tslint:disable: no-bitwise
        var R = f >> 16;
        var G = (f >> 8) & 0x00ff;
        var B = f & 0x0000ff;
        // tslint:enable: no-bitwise
        clr =
          '#' +
          (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B))
            .toString(16)
            .slice(1);
      } //clr = '#DCDCDC' //#D3D3D3 //For "greying" the non-mutated amino acids
    } else {
      console.log('Invalid option, something went wrong');
    }
    msaImage.paintCell(col, drawImageNSeq, clr);
  }
  drawImageNSeq++;
  setTimeout('asyncDrawMsaImage()', msaImageTimeout);
}

function resetMsaImage() {
  if (!msaImage) {
    return;
  }
  msaImage.init(1, 1, 100, 100);
}

// ---- stats view plota ---------------------------------------------------------------------------------

function UpdateStatsPlot() {
  var wi = 700;
  var he = 300;
  if (d3StatsPlots) {
    d3StatsPlots.remove();
  } else {
    d3StatsPlots = d3
      .select('#MSAstats')
      .append('svg')
      .attr('width', wi)
      .attr('height', he);
  }
  var plot = createPlot();
  // ref.seq not included
  plot.drawGrid(d3StatsPlots, wi, he, getRange(1, msa.h - 1, 10), getRange(0, 1, 10), '#9899c9');
  plot.addCurve('#585989', 4, msa.identS1.slice(1));
  plot.addCurve('#7879a9', 4, msa.gapsS.slice(1));
  $('#inp_gaps').val(msa.gapsMax);
  $('#inp_ident_min').val(msa.identR.min);
  $('#inp_ident_max').val(msa.identR.max);
}

function clearPlots() {
  if (d3PairwiseIdentityPlot) {
    d3PairwiseIdentityPlot.remove();
  }
  if (pwMap) {
    pwMap.clear();
  }
  if (d3fg) {
    d3fg.clear();
  }
}

function UpdatePairwisePlot() {
  if (!msa.pwseqminS.length) {
    clearPlots();
    return;
  }
  var wi = 700;
  var he = 300;
  if (d3PairwiseIdentityPlot) {
    clearPlots();
  }
  if (d3PairwiseIdentityPlot) {
    d3PairwiseIdentityPlot.remove();
  } else {
    d3PairwiseIdentityPlot = d3
      .select('#MSApairwise')
      .append('svg')
      .attr('width', wi)
      .attr('height', he);
  }
  var p = createPlot();
  p.drawGrid(d3PairwiseIdentityPlot, wi, he, getRange(1, msa.h, 10), getRange(0, 1, 10), '#9899c9');
  p.addCurve('#3e3f61', 4, msa.pwseqminS);
  p.addCurve('#585989', 4, msa.pwseqavgS);
  p.addCurve('#7792ba', 4, msa.pwseqmaxS);
  $('#inp_pwmin_min').val(msa.pwminR.min);
  $('#inp_pwmin_max').val(msa.pwminR.max);
  $('#inp_pwmax_min').val(msa.pwmaxR.min);
  $('#inp_pwmax_max').val(msa.pwmaxR.max);
  $('#inp_pwavg_min').val(msa.pwavgR.min);
  $('#inp_pwavg_max').val(msa.pwavgR.max);
  initPairwiseMap(wi);
}

function initPairwiseMap(w) {
  if (!pwMap) {
    var div = document.getElementById('MSApairwiseMap');
    var ca = div.getContext('2d');
    pwMap = createPairwiseMapCanvas(ca);
  }
  pwMap.initMap(w, msa.h);
  pwMapNSeq = 0;
  console.log('init pairwise map...');
  setTimeout('asyncDrawPairwiseMap()', msa.asyncTimeout);
}

function asyncDrawPairwiseMap() {
  if (pwMapNSeq === msa.h) {
    return;
  } // pairwise identity completed
  for (var j = 0; j < msa.h; j++) {
    if (pwMapNSeq === j) {
      continue;
    }
    var i = msa.getPairIdentity(pwMapNSeq, j);
    var c = Math.floor(255 * (1 - i));
    var q = c.toString(16);
    var hex = (c < 16 ? '0' : '') + q;
    //	var clr = '#' + (i<0.333 ? hex+'00ff' : (i<0.666 ? '00'+hex+'ff' : hex+hex+'ff'));
    var clr = '#' + hex + hex + 'ff';
    pwMap.paintCell(pwMapNSeq, j, clr);
  }
  pwMapNSeq++;
  setTimeout('asyncDrawPairwiseMap()', msa.asyncTimeout);
}

function initForceGraph() {
  if (!msa.pwdoneQ) {
    return;
  } // compute pairwise identity first
  var val = $('#graphSlider').slider('option', 'value');
  pwGraph = msa.buildPairwiseIdentityGraph(val);
  if (typeof d3fg === 'undefined') {
    d3fg = createForceGraph();
  }
  d3fg.init('#MSApairwiseGraph', 700, 700, pwGraph);
}

function handleDragOver(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

function handleFileSelect(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  var f = evt.target.files ? evt.target.files[0] : evt.dataTransfer.files[0];
  if (!f) {
    return;
  }
  $('#progress')
    .show()
    .html('reading the file...');
  var r = new FileReader();
  r.onload = function(e) {
    loadNewMSA(e.target.result);
  };
  r.readAsText(f);
  return false;
}

function handleCustomFileSelect(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  var f = evt.target.files ? evt.target.files[0] : evt.dataTransfer.files[0];
  if (!f) {
    return;
  }
  var r = new FileReader();
  r.onload = function(e) {
    msa.loadCustomMsaDataFile(e.target.result, function() {
      if (!msa.seqorder.cweightsA.length) {
        return;
      }
      $('#MSAcustomA').html(msa.hcustomwA);
      $('#MSAcustomB').html(msa.hcustomwB);
      $('#cdatStatus').html('mapped ' + msa.customweightsN + ' out of ' + msa.customweightsA.length + ' sequences');
      $('#order option[value="orderCustomAW"]').remove();
      $('#order option[value="orderCustomBW"]').remove();
      $("<option value='orderCustomAW'>custom order A</option>").appendTo('#order');
      $("<option value='orderCustomBW'>custom order B</option>").appendTo('#order');
      $('#MSAcustomAH').text('custom data A');
      $('#MSAcustomBH').text('custom data B');
      console.log($('#MSAcustomAH').text);
      console.log('>>> got some sorted custom weights....');
    });
  };
  r.readAsText(f);
  return false;
}

function handleCustomFileSelectCouplings(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  var f = evt.target.files ? evt.target.files[0] : evt.dataTransfer.files[0];
  if (!f) {
    return;
  }
  var r = new FileReader();
  r.onload = function(e) {
    msa.loadCouplingsDataFile(e.target.result, function() {
      $('#cdatStatus2').html('mapped ' + msa.couplingsN);
      console.log('>>> got the couplings');
      var aux = {};
      aux.A = msa.A;
      aux.B = msa.B;
      console.log(msa.A);
      console.log(aux.B);
      var len = msa.getNormalizedColumnProportions().length;
      var couplingsLogoDiagram = new CouplingsLogoDiagramD3(
        { elementId: 'couplingslogo', elementWidth: msaTextblockWidth, elementHeight: 30 },
        aux,
        len,
      );
      couplingsLogoDiagram.initDiagram();
    });
  };
  r.readAsText(f);
  return false;
}

function UpdateSpeciesDiagram() {
  var width = 700;
  var height = 600;
  var radius = Math.min(width, height) / 2 - 50;
  var color = d3.scale.category20();
  //	color = {E:'#00e000', A:'#e00000', B:'#0000e0', V:'#228888'};

  var svg = d3
    .select('#specburst')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', 'translate(' + width / 2 + ',' + height * 0.52 + ')');

  var partition = d3.layout
    .partition()
    .sort(null)
    .size([2 * Math.PI, radius * radius])
    .value(function(d) {
      return 1;
    });

  var arc = d3.svg
    .arc()
    .startAngle(function(d) {
      return d.x;
    })
    .endAngle(function(d) {
      return d.x + d.dx;
    })
    .innerRadius(function(d) {
      return Math.sqrt(d.y);
    })
    .outerRadius(function(d) {
      return Math.sqrt(d.y + d.dy);
    });

  var testobj = {
    name: 'flare',
    children: [
      { name: 'sdsdfsdf', size: 2, children: [{ name: 'a', size: 23 }, { name: 'b', size: 12 }] },
      {
        name: 'qweqwecv',
        size: 3,
        children: [{ name: 'c', size: 35 }, { name: 'd', size: 53 }, { name: 'e', size: 2 }],
      },
    ],
  };

  var obj = { name: 'species', children: [] }; // have to convert object (hash-table) to array
  console.log(msa.specdist.children);
  for (var e of Object.keys(msa.specdist.children)) {
    var o = msa.specdist.children[e];
    var v = { name: o.name, size: o.size, children: [] };
    for (var c of Object.keys(o.children)) {
      var o2 = o.children[c];
      var v2 = { name: o2.name, size: o2.size };
      v.children.push(v2);
    }
    obj.children.push(v);
  }
  var path = svg
    .datum(obj)
    .selectAll('path')
    .data(partition.nodes)
    .enter()
    .append('path')
    .attr('display', function(d) {
      return d.depth ? null : 'none';
    }) // hide inner ring
    .attr('d', arc)
    .style('stroke', '#fff')
    .style('fill', function(d) {
      return color((d.children ? d : d.parent).name); /*color.hasOwnProperty(d.name) ? color[d.name] : 'grey'; */
    })
    .style('fill-rule', 'evenodd')
    .each(stash);

  path
    .data(
      partition.value(function(d) {
        return d.size;
      }).nodes,
    )
    .transition()
    .duration(1500)
    .attrTween('d', arcTween);

  function stash(d) {
    d.x0 = d.x;
    d.dx0 = d.dx;
  } // Stash the old values for transition
  function arcTween(a) {
    // Interpolate the arcs in data space
    var i = d3.interpolate({ x: a.x0, dx: a.dx0 }, a);
    return function(t) {
      var b = i(t);
      a.x0 = b.x;
      a.dx0 = b.dx;
      return arc(b);
    };
  }
  d3.select(self.frameElement).style('height', height + 'px');
}
