/**
 * -*- compile-command: "jslint-cli main.js" -*-
 * 
 * Copyright (C) 2011 Cedric Pinson
 * 
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation; either version 3 of the License, or any later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License along with
 * this program; if not, write to the Free Software Foundation, Inc., 51
 * Franklin St, Fifth Floor, Boston, MA 02110-1301, USA.
 * 
 * Authors: Cedric Pinson <cedric.pinson@plopbyte.net>
 * 
 */

var WebGL = {};
 WebGL.gURL = "";
 WebGL.gviewer;
 WebGL.gSceneRoot;
 WebGL.gWireframeButton;
 WebGL.gUpButton;
 WebGL.gRadius = 1;
 WebGL.gCameraOffset = [ WebGL.gRadius, 0, 0 ];
 WebGL.gCameraTarget = [ 0, 0, 0 ];
 WebGL.gUpVector = [ 0, 1, 0 ];
 WebGL.gCameraGoal = WebGL.gCameraOffset;
 WebGL.gAnimating = false;
 WebGL.gOldX = 0;
 WebGL.gOldY = 0;
 WebGL.gMouseDown = false;
 WebGL.gGridNode;
 WebGL.gModelRoot;
 WebGL.gSceneBounds;
 WebGL.gOriginalSceneBounds;
 WebGL.gCamera;
 WebGL.g_RTT;
 WebGL.ViewMatrixUniform;
 WebGL.ShadowMatrixUniform;
 WebGL.gAnimatingRotation = false;
 WebGL.gCanvasSizeUniform;
 WebGL.gPID = "";
 WebGL.gUnitScale = 1.0;
 WebGL.tempUpVec;
 WebGL.tempScale;
 WebGL.ShadowMapResolution = '1024.0';
 
function BuildModelTransform()
{
    WebGL.gModelRoot.setMatrix(osg.Matrix.makeScale(WebGL.gUnitScale,WebGL.gUnitScale,WebGL.gUnitScale));
}
function WebGlSetUnitScale(scale)
{
    WebGL.gUnitScale = scale;
    BuildModelTransform();
    UpdateBounds();
    RebuildGrid();
    UpdateCamera();
}
function UpdateBounds()
{   
    var bv = new BoundsVisitor();
    var newpoints = WebGL.gOriginalSceneBounds.points.concat([]);
    newpoints = bv.transformArray(WebGL.gModelRoot.matrix,newpoints);
    newpoints = bv.boundsFromArray(newpoints);
    //bv.apply(WebGL.gModelRoot);
    WebGL.gSceneBounds = new BoundingBox(newpoints);
    
}
function WebGlSetUpVector(vec)
{
    if(vec == 'Y' && WebGLGetUpVector() == "Z")
	SwapUpVector();
    else if(vec == 'Z' && WebGLGetUpVector() == "Y")
	SwapUpVector();
   
    UpdateBounds();
    //RebuildGrid();
}
function BoundingBox(array) {
    var bv = new BoundsVisitor();
    this.points = bv.boundsFromArray(array);
    this.GetMin = function() {
	return [ this.points[0], this.points[1], this.points[2] ];
    };
    this.GetMax = function() {
	return [ this.points[21], this.points[22], this.points[23] ];
    };
    this.GetCenter = function() {
	return osg.Vec3.mult(osg.Vec3.add(this.GetMax(), this.GetMin()), .5);
    };
    this.GetRadius = function() {
	return osg.Vec3.length(osg.Vec3.sub(this.GetMax(), this.GetCenter()));
    };
}

function getWindowSize() {
    var myWidth = 0;
    var myHeight = 0;

    if (typeof (window.innerWidth) == 'number') {
	// Non-IE
	myWidth = window.innerWidth;
	myHeight = window.innerHeight;
    } else if (document.documentElement
	    && (document.documentElement.clientWidth || document.documentElement.clientHeight)) {
	// IE 6+ in 'standards compliant mode'
	myWidth = document.documentElement.clientWidth;
	myHeight = document.documentElement.clientHeight;
    } else if (document.body
	    && (document.body.clientWidth || document.body.clientHeight)) {
	// IE 4 compatible
	myWidth = document.body.clientWidth;
	myHeight = document.body.clientHeight;
    }
    return {
	'w' : myWidth,
	'h' : myHeight
    };
}

function WebGLScreenshot() {

    var shot = WebGL.gviewer.canvas.toDataURL();
    // SendThumbnailPng(shot);

    ajaxImageSend("../Public/ScreenShot.ashx" + '?' + WebGL.gPID + '&Format=png',
	    shot, '?' + WebGL.gPID);

}

var QueryParams = new Array();

function BuildGridGeometry() {
    var tex = osg.Texture.create("../../../Images/grid.jpg");
    tex.mag_filter = "LINEAR";
    tex.min_filter = "LINEAR";

    var QuadSizeX = WebGL.gSceneBounds.GetRadius() * 10;
    var QuadSizeY = WebGL.gSceneBounds.GetRadius() * 10;
    var rq;
    if (WebGLGetUpVector() == "Y") {
	rq = osg.createTexuredQuad(QuadSizeX / 2.0, 0, -QuadSizeY / 2.0,
		-QuadSizeX, 0, 0, 0, 0, QuadSizeY, WebGL.gSceneBounds.GetRadius(),
		WebGL.gSceneBounds.GetRadius(), 0, 0);
    } else {
	rq = osg.createTexuredQuad(-QuadSizeX / 2.0, -QuadSizeY / 2.0, 0,
		QuadSizeX, 0, 0, 0, QuadSizeY, 0, WebGL.gSceneBounds.GetRadius(),
		WebGL.gSceneBounds.GetRadius(), 0, 0);
    }
    rq.getOrCreateStateSet().setTextureAttributeAndMode(0, tex);

    var newmaterial = osg.Material.create();

    newmaterial.diffuse = [ .1, .1, .1, .1 ];
    newmaterial.ambient = [ .5, .5, .5, .1 ];
    newmaterial.emissive = [ .1, .1, .1, .1 ];
    newmaterial.name = "asdf";
    newmaterial.shininess = .10;
    newmaterial.specular = [ 0.09, 0.09, 0.09, .1 ];

    rq.getOrCreateStateSet().setAttribute(newmaterial);
    rq.getOrCreateStateSet().setAttribute(new osg.CullFace("DISABLE"));

    var n = new osg.MatrixTransform();
    n.addChild(rq);
    // alert([WebGL.gSceneBounds.GetCenter()[0],WebGL.gSceneBounds.GetCenter()[1],WebGL.gSceneBounds.GetCenter()[2]]);
    if (WebGLGetUpVector() == "Z") {
	n.matrix = osg.Matrix.makeTranslate(WebGL.gSceneBounds.GetCenter()[0],
		WebGL.gSceneBounds.GetCenter()[1], WebGL.gSceneBounds.GetMin()[2]);
    } else
	n.matrix = osg.Matrix.makeTranslate(WebGL.gSceneBounds.GetCenter()[0],
		WebGL.gSceneBounds.GetMin()[1], WebGL.gSceneBounds.GetCenter()[2]);
    return n;

}

function LoadQueryParams() {

    var query = window.location.search.substring(1);
    var parms = query.split('&');
    for ( var i = 0; i < parms.length; i++) {
	var pos = parms[i].indexOf('=');
	if (pos > 0) {
	    var key = parms[i].substring(0, pos);
	    var val = parms[i].substring(pos + 1);
	    QueryParams[key] = val;
	}
    }
    var pos = query.lastIndexOf('URL=');
    var URL = query.substring(pos + 4, query.length);
    // alert(URL);
    if (QueryParams['URL'] != null)
	QueryParams['URL'] = URL;
}

function convertEventToCanvas(e) {
    var myObject = WebGL.gviewer.canvas;
    var posx, posy;
    if (e.pageX || e.pageY) {
	posx = e.pageX;
	posy = e.pageY;
    } else if (e.clientX || e.clientY) {
	posx = e.clientX + document.body.scrollLeft
		+ document.documentElement.scrollLeft;
	posy = e.clientY + document.body.scrollTop
		+ document.documentElement.scrollTop;
    }

    var divGlobalOffset = function(obj) {
	var x = 0, y = 0;
	x = obj.offsetLeft;
	y = obj.offsetTop;
	var body = document.getElementsByTagName('body')[0];
	while (obj.offsetParent && obj != body) {
	    x += obj.offsetParent.offsetLeft;
	    y += obj.offsetParent.offsetTop;
	    obj = obj.offsetParent;
	}
	return [ x, y ];
    };
    // posx and posy contain the mouse position relative to the document
    // Do something with this information
    var globalOffset = divGlobalOffset(myObject);
    posx = posx - globalOffset[0];
    posy = myObject.height - (posy - globalOffset[1]);

    var ret = [ WebGL.gOldX - posx, WebGL.gOldY - posy ];
    WebGL.gOldX = posx;
    WebGL.gOldY = posy;
    return ret;

};
function WebGLGetUpVector() {
    if (WebGL.gUpVector[0] == 0 && WebGL.gUpVector[1] == 1 && WebGL.gUpVector[2] == 0)
	return "Y";
    else if (WebGL.gUpVector[0] == 0 && WebGL.gUpVector[1] == 0 && WebGL.gUpVector[2] == 1)
	return "Z";
}
function SetUpY() {
    WebGL.gUpVector = [ 0, 1, 0 ];
    UpdateCamera();
}
function SetUpZ() {
    WebGL.gUpVector = [ 0, 0, 1 ];
    UpdateCamera();
}
function SwapUpVector() {
    // IF is Y

    BuildModelTransform();
    if (WebGL.gUpVector[0] == 0 && WebGL.gUpVector[1] == 1 && WebGL.gUpVector[2] == 0)
	SetUpZ();
    else if (WebGL.gUpVector[0] == 0 && WebGL.gUpVector[1] == 0 && WebGL.gUpVector[2] == 1)
	SetUpY();
    RebuildGrid();
}
function Mousedown(x, y) {
    WebGL.gAnimating = false;
    WebGL.gMouseDown = true;
}
function Mouseup(x, y) {
    WebGL.gMouseDown = false;
}
function RotateCamera(x, y) {
    var r = osg.Matrix.makeRotate(x / 100.0, WebGL.gUpVector[0], WebGL.gUpVector[1],
	    WebGL.gUpVector[2]);
    var cross = osg.Vec3.cross(WebGL.gUpVector, WebGL.gCameraOffset);

    var of = osg.Matrix.makeRotate(-y / 100.0, cross[0], cross[1], cross[2]);
    var r2 = osg.Matrix.mult(r, of);

    // test that the eye is not too up and not too down to not kill
    // the rotation matrix
    WebGL.gCameraOffset = osg.Matrix.transformVec3(osg.Matrix.inverse(r2),
	    WebGL.gCameraOffset);

}
function Mousemove(x, y) {
    if (WebGL.gMouseDown == true) {
	RotateCamera(x, y);
    }
}

function UpdateShadowCastingProjectionMatrix()
{
    UpdateBounds();
    var bv = new BoundsVisitor();
    var newpoints = [];
    newpoints = newpoints.concat(WebGL.gSceneBounds.points);
    var ViewSpacePoints = bv.transformArray(WebGL.g_RTT.getViewMatrix(),newpoints);
    var ViewSpaceMinMax = bv.boundsFromArray(ViewSpacePoints);
    var VSBB = new BoundingBox(ViewSpacePoints);
    //alert(VSBB.GetMin());
    WebGL.g_RTT.setProjectionMatrix(osg.Matrix.makeOrtho(VSBB.GetMin()[1] * 1.1,
		VSBB.GetMax()[1] * 1.1, VSBB.GetMin()[0] * 1.1, VSBB.GetMax()[0] * 1.1, .01, 10000));

   // alert(VSBB.GetMax());
  //  alert(VSBB.GetMin());
  //  WebGL.g_RTT.setProjectionMatrix(osg.Matrix.makeOrtho(-VSBB
//		.GetRadius() * 1, VSBB.GetRadius() * 1, -VSBB
//		.GetRadius() * 1, VSBB.GetRadius() * 1, .01, 10000.0));

}

function UpdateCamera() {
    WebGL.gCamera.setViewMatrix(osg.Matrix.makeLookAt(osg.Vec3.add(WebGL.gCameraOffset,
	    WebGL.gCameraTarget), WebGL.gCameraTarget, WebGL.gUpVector));

    if (WebGL.g_RTT) {
	WebGL.g_RTT.setViewMatrix(osg.Matrix.makeLookAt(osg.Vec3.add([
		WebGL.gSceneBounds.GetRadius() * 5.5, WebGL.gSceneBounds.GetRadius() * 5.5,
		WebGL.gSceneBounds.GetRadius() * 5.5 ], WebGL.gCameraTarget),
		WebGL.gCameraTarget, WebGL.gUpVector));

	// WebGL.g_RTT.setViewMatrix(WebGL.gCamera.getViewMatrix());
	// WebGL.g_RTT.setProjectionMatrix(WebGL.gCamera.getProjectionMatrix());

	WebGL.g_RTT.setProjectionMatrix(osg.Matrix.makeOrtho(-WebGL.gSceneBounds
		.GetRadius() * 1, WebGL.gSceneBounds.GetRadius() * 1, -WebGL.gSceneBounds
		.GetRadius() * 1, WebGL.gSceneBounds.GetRadius() * 1, .01, 10000.0));

	UpdateShadowCastingProjectionMatrix();
	
	if (WebGL.ViewMatrixUniform)
	    WebGL.ViewMatrixUniform.set(osg.Matrix.inverse(WebGL.gCamera.getViewMatrix()));
	
	if (WebGL.ShadowMatrixUniform)
	    WebGL.ShadowMatrixUniform.set(osg.Matrix.mult(
		    WebGL.g_RTT.getProjectionMatrix(), WebGL.g_RTT.getViewMatrix()));
	// WebGL.ShadowMatrixUniform.set(osg.Matrix.mult(WebGL.g_RTT.getProjectionMatrix(),WebGL.g_RTT.getViewMatrix()));

	// alert([WebGL.gviewer.canvas.clientWidth,WebGL.gviewer.canvas.clientHeight]);
	if (WebGL.gCanvasSizeUniform)
	    WebGL.gCanvasSizeUniform.set([ WebGL.gviewer.canvas.clientWidth,
		    WebGL.gviewer.canvas.clientHeight ]);

	//WebGL.gCamera.setViewMatrix(WebGL.g_RTT.getViewMatrix());
	//WebGL.gCamera.setProjectionMatrix(WebGL.g_RTT.getProjectionMatrix());
    }
}
function BindInputs() {

    jQuery(WebGL.gviewer.canvas).bind({
	mousedown : function(ev) {

	    var evt = convertEventToCanvas(ev);
	    Mousedown(evt[0], evt[1]);
	    UpdateCamera();
	},
	mouseup : function(ev) {

	    var evt = convertEventToCanvas(ev);
	    Mouseup(evt[0], evt[1]);
	    UpdateCamera();
	},
	mousemove : function(ev) {

	    var evt = convertEventToCanvas(ev);
	    Mousemove(evt[0], evt[1]);
	    UpdateCamera();
	}
    });

    if (true) {
	// if (jQuery(document).mousewheel !== undefined) {
	jQuery(document).mousewheel(
		function(objEvent, intDelta, deltaX, deltaY) {
		    WebGL.gAnimating = false;
		    if (intDelta > 0) {
			// manipulator.distanceDecrease();
			WebGL.gCameraOffset = osg.Vec3.mult(WebGL.gCameraOffset, .9);
		    } else if (intDelta < 0) {
			WebGL.gCameraOffset = osg.Vec3.mult(WebGL.gCameraOffset, 1.1);
		    }
		    return false;
		});
	// }
    }

    if (true) {
	jQuery(document).bind({
	    'keydown' : function(event) {
		if (event.keyCode === 33) { // pageup
		    // manipulator.distanceIncrease();
		    return false;
		} else if (event.keyCode === 34) { // pagedown
		    // manipulator.distanceDecrease();
		    return false;
		}
	    }
	});
    }
}
function CreateButton(url, overurl, x, y, count, action) {

    var newbutton = new Image();
    newbutton.src = url;

    document.getElementById('canvas_Wrapper').appendChild(newbutton);
    newbutton.style.display = "block";
    newbutton.style.zIndex = 10000;
    newbutton.style.position = "absolute";
    newbutton.style.top = (y) + 'px';
    newbutton.style.left = (x + 21 * count) + 'px';
    newbutton.style.width = 20;
    newbutton.style.height = 20;
    newbutton.onmouseover = function() {
	this.src = overurl;
    };
    newbutton.onmouseout = function() {
	this.src = url;
    };
    newbutton.onclick = action;
    return newbutton;
}
function CreateButtons() {
    CreateButton("../../../../Images/Icons/3dr_btn_T_cube.png",
	    "../../../../Images/Icons/3dr_btn_T_grey_cube.png", 0, 0, 0,
	    AnimateTop);
    CreateButton("../../../../Images/Icons/3dr_btn_L_cube.png",
	    "../../../../Images/Icons/3dr_btn_L_grey_cube.png", 0, 0, 1,
	    AnimateFront);
    CreateButton("../../../../Images/Icons/3dr_btn_R_cube.png",
	    "../../../../Images/Icons/3dr_btn_R_grey_cube.png", 0, 0, 2,
	    AnimateLeft);
    WebGL.gUpButton = CreateButton("../../../../Images/Icons/3dr_btn_Y.png",
	    "../../../../Images/Icons/3dr_btn_grey_Y.png", 0, 0, 3,
	    SwapUpVector);
    WebGL.gWireframeButton = CreateButton(
	    "../../../../Images/Icons/3dr_btn_blue_wireframe.png",
	    "../../../../Images/Icons/3dr_btn_grey_wireframe.png", 0, 0, 4,
	    ApplyWireframe);
    CreateButton("../../../../Images/Icons/3dr_btn_blue_camera.png",
	    "../../../../Images/Icons/3dr_btn_grey_camera.png", 0, 0, 5,
	    ApplyWireframe);
    CreateButton("../../../../Images/Icons/3dr_btn_Left.png",
	    "../../../../Images/Icons/3dr_btn_grey_Left.png", 0, 0, 5,
	    ToggleAnimation);
}
function ToggleAnimation() {
    WebGL.gAnimatingRotation = WebGL.gAnimatingRotation == false;
    BuildModelTransform()
}
function initWebGL(location, showscreenshot, upaxis, scale  ) {
    
    
    WebGL.tempUpVec = upaxis;
    WebGL.tempScale = scale;
    
    var size = getWindowSize();

    var canvas = document.getElementById("WebGLCanvas");

    // canvas.clientWidth = size.w;
    // canvas.clientHeight = size.h;

    var qpos = location.indexOf('?');

    WebGL.gPID = location.substr(qpos + 1);
    qpos = WebGL.gPID.indexOf('.zip');
    WebGL.gPID = WebGL.gPID.substr(0, qpos + 4);
    WebGL.gPID = WebGL.gPID.replace("pid=", "ContentObjectID=");

    var viewer;
    try {
	LoadQueryParams();
	viewer = new osgViewer.Viewer(canvas);

	viewer.init();
	// viewer.setupManipulator();
	WebGL.gviewer = viewer;
	createScene(viewer, location);
    } catch (er) {
	osg.log("exception in osgViewer " + er);
	alert(er);
    }
    CreateButtons();
    BindInputs();
    
    
    
    return true;
}

function Texture_Load_Callback(texturename) {

    return osg.Texture.create(WebGL.gURL + "&Texture=" + texturename);
};
function AnimateTop() {
    WebGL.gAnimating = true;
    // alert(WebGLGetUpVector() === "Z");
    if (WebGLGetUpVector() === "Y")
	WebGL.gCameraGoal = [ 0, 0, osg.Vec3.length(WebGL.gCameraOffset) ];
    else
	WebGL.gCameraGoal = [ 0, osg.Vec3.length(WebGL.gCameraOffset), 0 ];
}
function AnimateFront() {
    WebGL.gAnimating = true;
    WebGL.gCameraGoal = [ osg.Vec3.length(WebGL.gCameraOffset), 0, 0 ];
}
function AnimateLeft() {
    WebGL.gAnimating = true;
    if (WebGLGetUpVector() === "Y")
	WebGL.gCameraGoal = [ 0, osg.Vec3.length(WebGL.gCameraOffset), 0 ];
    else
	WebGL.gCameraGoal = [ 0, 0, osg.Vec3.length(WebGL.gCameraOffset) ];
}
var AmbientVisitor = function(incolor) {
    osg.NodeVisitor.call(this);
    this.color = incolor;
};
var AnimationCallback = function() {
};
AnimationCallback.prototype = {
    update : function() {

	if (WebGL.gModelRoot && WebGL.gAnimatingRotation == true) {
	    
	    WebGL.gModelRoot.setMatrix(osg.Matrix.mult(WebGL.gModelRoot.getMatrix(),
		    osg.Matrix.makeRotate(.005, WebGL.gUpVector[0], WebGL.gUpVector[1],
			    WebGL.gUpVector[2])));
	    UpdateCamera();

	}

	if (WebGL.gAnimating) {
	    var tempoffset = [ 0, 0, 0 ];
	    osg.Vec3.copy(WebGL.gCameraOffset, tempoffset);
	    tempoffset = osg.Vec3.normalize(tempoffset);

	    var tempgoal = [ 0, 0, 0 ];
	    osg.Vec3.copy(WebGL.gCameraGoal, tempgoal);
	    tempgoal = osg.Vec3.normalize(tempgoal);

	    var dot = osg.Vec3.dot(tempoffset, tempgoal);
	    if (dot > .99
		    && osg.Vec3
			    .length(osg.Vec3.sub(WebGL.gCameraOffset, WebGL.gCameraGoal)) < .1)
		WebGL.gAnimating = false;
	    else {
		WebGL.gCameraOffset = osg.Vec3.lerp(.02, WebGL.gCameraOffset, WebGL.gCameraGoal);
		UpdateCamera();
	    }
	}
    }
};
function RebuildGrid() {
  
    if (WebGL.gGridNode && WebGL.gSceneRoot)
	WebGL.gSceneRoot.removeChild(WebGL.gGridNode);
   if(WebGL.gSceneBounds)
    {
        WebGL.gGridNode = BuildGridGeometry();
        WebGL.gSceneRoot.addChild(WebGL.gGridNode);
    }
}
function CreateBoundsGeometry(vertexes) {
    var g = new osg.Geometry();
    g.getAttributes().Vertex = osg.BufferArray.create(gl.ARRAY_BUFFER,
	    vertexes, 3);
    var normals = [];
    for ( var i = 0; i < vertexes.length; i++)
	normals.push(.707);

    var tcs = [];
    for ( var i = 0; i < vertexes.length / 3; i++) {
	tcs.push(1);
	tcs.push(0);
    }

    g.getAttributes().Normal = osg.BufferArray.create(gl.ARRAY_BUFFER, normals,
	    3);
    g.getAttributes().TexCoord0 = osg.BufferArray.create(gl.ARRAY_BUFFER, tcs,
	    2);

    var lines = new osg.DrawElements(gl.LINES, osg.BufferArray.create(
	    gl.ELEMENT_ARRAY_BUFFER, [ 6, 4, 6, 7, 7, 5, 5, 4, 2, 3, 3, 1, 1,
		    0, 0, 2, 2, 6, 0, 4, 1, 5, 3, 7 ], 24));

    var TRIANGLES = new osg.DrawElements(gl.TRIANGLES, osg.BufferArray.create(
	    gl.ELEMENT_ARRAY_BUFFER, [ 6, 4, 5, 5, 7, 6, 2, 3, 1, 1, 0, 2, 2,
		    6, 7, 7, 3, 2, 0, 4, 5, 1, 5, 0, 3, 7, 5, 1, 5, 3, 2, 6, 0,
		    0, 4, 6 ], 48));
    g.getPrimitives().push(lines);
    // g.getPrimitives().push(TRIANGLES);

    var newmaterial = osg.Material.create();

    newmaterial.diffuse = [ 0.0, 0.0, 0.0, 0.1 ];
    newmaterial.ambient = [ 0.0, 0.0, 0.0, 1 ];
    newmaterial.emissive = [ 0.0, 0.0, 0.0, 1 ];
    newmaterial.name = "asdf";
    newmaterial.shininess = .0;
    newmaterial.specular = [ 0.09, 0.09, 0.09, .1 ];

    g.getOrCreateStateSet().setAttribute(newmaterial);
    g.getOrCreateStateSet().setAttribute(new osg.CullFace("DISABLE"));

    return g;
}

function GetDepthShader() {

    var vertshader = [
	    "",
	    "#ifdef GL_ES",
	    "precision highp float;",
	    "#endif",
	    "attribute vec3 Vertex;",
	    "attribute vec3 Normal;",
	    "attribute vec2 TexCoord0;",
	    "uniform mat4 ModelViewMatrix;",
	    "uniform mat4 ProjectionMatrix;",
	    "uniform mat4 NormalMatrix;",
	    "varying vec3 oNormal;",
	    "varying vec2 oTC0;",
	    "varying vec4 oViewSpaceVertex;",
	    "",
	    "vec4 ftransform() {",
	    "return ProjectionMatrix * ModelViewMatrix * vec4(Vertex, 1.0);",
	    "}",
	    "",
	    "void main() {",
	    "gl_Position = ftransform();",
	    "oNormal = (NormalMatrix * vec4(Normal,1.0)).xyz;",
	    "oTC0 = TexCoord0;",
	    "oViewSpaceVertex = (ProjectionMatrix * ModelViewMatrix * vec4(Vertex, 1.0));",
	    "}" ].join('\n');

    var fragshader = [
	    "",
	    "#ifdef GL_ES",
	    "precision highp float;",
	    "#endif",
	    "varying vec3 oNormal;",
	    "varying vec2 oTC0;",
	    "uniform sampler2D texture;",
	    "varying vec4 oViewSpaceVertex;",
	    "",
	    "vec4 packFloatToVec4i(const float value)",
	    "{",
	    "  const vec4 bitSh = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);",
	    "  const vec4 bitMsk = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);",
	    "  vec4 res = fract(value * bitSh);",
	    "  res -= res.xxyz * bitMsk;",
	    "  return res;",
	    "}",
	    "float unpackFloatFromVec4i(const vec4 value)",
	    "{",
	    "  const vec4 bitSh = vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0);",
	    "  return(dot(value, bitSh));", "}", "void main() {",
	    "//gl_FragColor = texture2D(texture,oTC0);", "float near = 1.0;",
	    "float far = 10.0;",
	    "vec4 oViewSpaceVertexW = oViewSpaceVertex / oViewSpaceVertex.w;",
	    "float d = (oViewSpaceVertexW.z + near) / (far - near);",

	    "gl_FragColor = packFloatToVec4i(d);",

	    "}" ].join('\n');

    var Frag = osg.Shader.create(gl.FRAGMENT_SHADER, fragshader);
    var Vert = osg.Shader.create(gl.VERTEX_SHADER, vertshader);

    var Prog = osg.Program.create(Vert, Frag);
    return Prog;

}
function GetRecieveShadows() {

    var vertshader = [
	    "",
	    "#ifdef GL_ES",
	    "precision highp float;",
	    "#endif",
	    "attribute vec3 Vertex;",
	    "attribute vec3 Normal;",
	    "attribute vec2 TexCoord0;",
	    "uniform mat4 ModelViewMatrix;",
	    "uniform mat4 ProjectionMatrix;",
	    "uniform mat4 NormalMatrix;",
	    "varying vec3 oNormal;",
	    "varying vec2 oTC0;",
	    "varying vec3 oViewSpaceVertex;",
	    "uniform mat4 shadowProjection;",
	    "uniform mat4 inverseViewMatrix;",
	    "varying vec4 oScreenPosition;",
	    "varying vec4 oShadowSpaceVertex;",
	    "varying vec3 oLightSpaceNormal;",
	    "varying vec3 oLightDir;",
	    "",
	    "vec4 ftransform() {",
	    "return ProjectionMatrix * ModelViewMatrix * vec4(Vertex, 1.0);",
	    "}",
	    "",
	    "void main() {",
	    "gl_Position = ftransform();",
	    "oScreenPosition = gl_Position;",
	    //"Normal = normalize(Normal);",
	    "oNormal = normalize((NormalMatrix * vec4(Normal,1.0)).xyz);",
	    "oTC0 = TexCoord0;",
	    "oViewSpaceVertex = (ModelViewMatrix * vec4(Vertex, 1.0)).xyz;",
	    "mat4 ModelMatrix =  inverseViewMatrix * ModelViewMatrix;",

	    "oShadowSpaceVertex = (ModelMatrix * vec4(Vertex, 1.0));",
	    "oShadowSpaceVertex = (shadowProjection * oShadowSpaceVertex);",
	    "oLightSpaceNormal = (ModelMatrix * vec4(Normal, 1.0)).xyz - vec3(ModelMatrix[3][0],ModelMatrix[3][1],ModelMatrix[3][2]);",
	    // "oLightSpaceNormal = normalize((shadowProjection * vec4(Normal,
	    // 1.0)).xyz);",
	    "oLightDir = normalize((vec4(1.0,1.0,1.0,1.0)).xyz);", "}" ]
	    .join('\n');

    var fragshader = [
	    "",
	    "#ifdef GL_ES",
	    "precision highp float;",
	    "#endif",
	    "varying vec3 oNormal;",
	    "varying vec2 oTC0;",
	    "uniform sampler2D texture;",
	    "uniform sampler2D shadowmap;",
	    "uniform vec2 canvasSize;",
	    "varying vec3 oViewSpaceVertex;",
	    "uniform mat4 shadowProjection;",
	    "varying vec4 oShadowSpaceVertex;",
	    "varying vec4 oScreenPosition;",
	    "varying vec3 oLightSpaceNormal;",
	    "varying vec3 oLightDir;",
	    "uniform vec4 MaterialDiffuse;",
	    "",
	    "float unpackFloatFromVec4i(const vec4 value)",
	    "{",
	    "  const vec4 bitSh = vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0);",
	    "  return(dot(value, bitSh));",
	    "}",
	    "float offset_lookup(sampler2D map, vec4 shadowCoord, vec2 offset)",
	    "{ ",

	    // the 512 here should be the shadowmap resolution!
	    "float shadowz = unpackFloatFromVec4i(texture2D(map,shadowCoord.xy + offset * (1.0/" + WebGL.ShadowMapResolution +")));",
	    "float near = 1.0;",
	    "float far = 10.0;",

	    "float d = (shadowCoord.z + near) / (far - near);",
	    "float shadow = d < shadowz ? 1.0 : 0.0;",
	    "return shadow;",
	    "}",
	    "float getShadowColor(vec4 shadowCoord, vec4 screenpos, float ScreenHeight, float ScreenWidth, sampler2D shadowTexture)",
	    "{",

	    "	float bias;",
	    "	bias   = -.00002;",
	    "	shadowCoord.z += bias;",

	    "	vec2 offset = vec2(0.0,0.0);",

	    // generate a grid based on the screen size
	    // these numbers 400 and 300 should be 1/2 the screen height and
	    // width
	    "	offset.x = fract((screenpos.x/screenpos.w + 1.0)/2.0 * ScreenWidth/2.0) > 0.5 ? 1.0 : 0.0;",
	    "	offset.y = fract((screenpos.y/screenpos.w + 1.0)/2.0 * ScreenHeight/2.0) > 0.5 ? 1.0 : 0.0;// > 0.25;",
	    "	offset.y += offset.x;  // y ^= x in floating point",

	    "	if (offset.y > 1.1)",
	    "	offset.y = 0.0;",

	    // Average the samples
	    "vec4 tc = shadowCoord*" +WebGL.ShadowMapResolution+";",
	    "vec4 sc = floor(tc);",
	    "vec4 fractional = tc-sc;",
	    "tc = tc * 1.0/"+WebGL.ShadowMapResolution+";",

	    " float x1 = offset_lookup(shadowTexture, shadowCoord, offset + vec2(0.0, 0.0));",
	    "	float x2 = offset_lookup(shadowTexture, shadowCoord, offset + vec2(1.0, 0.0)); ",
	    " float x3 = offset_lookup(shadowTexture, shadowCoord, offset + vec2(0.0, 1.0)); ",
	    " float x4 = offset_lookup(shadowTexture, shadowCoord, offset + vec2(1.0, 1.0)); ",
	    // "return (x1 + x2 + x3 + x4) / 4.0;",
	    "float a = mix(x1,x2,fractional.x);",
	    "float b = mix(x3,x4,fractional.x);",
	    "return mix(a,b,fractional.y);",
	    "}",

	    "vec4 packFloatToVec4i(const float value)",
	    "{",
	    "  const vec4 bitSh = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);",
	    "  const vec4 bitMsk = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);",
	    "  vec4 res = fract(value * bitSh);",
	    "  res -= res.xxyz * bitMsk;",
	    "  return res;",
	    "}",
	    "void main() {",
	    "vec4 oShadowSpaceVertexW = oShadowSpaceVertex / oShadowSpaceVertex.w;",
	    "oShadowSpaceVertexW.xy *= .5;",
	    "oShadowSpaceVertexW.xy += .5;",

	    "float shadow = getShadowColor(oShadowSpaceVertexW,oScreenPosition,canvasSize.y,canvasSize.x,shadowmap);",

	    "	float NdotL = dot(normalize(oLightSpaceNormal),normalize(oLightDir));",
	   
	    "gl_FragColor =  min(clamp(shadow,0.3,1.0),clamp(NdotL+.3,.3,1.0))*1.2 * (texture2D(texture,oTC0) + MaterialDiffuse);",

	    "gl_FragColor.a = 1.0;", "}" ].join('\n');

    var Frag = osg.Shader.create(gl.FRAGMENT_SHADER, fragshader);
    var Vert = osg.Shader.create(gl.VERTEX_SHADER, vertshader);

    var Prog = osg.Program.create(Vert, Frag);
    return Prog;

}
function BuildShadowCamera() {

    var rtt = new osg.Camera();
    rtt.setName("rtt_camera");
    rttSize = [ WebGL.ShadowMapResolution, WebGL.ShadowMapResolution ];
    // rttSize = [1920,1200];
    // rtt.setProjectionMatrix(osg.Matrix.makePerspective(60, 1, .1, 10000));
    rtt.setProjectionMatrix(osg.Matrix.makeOrtho(-1, 1, -1, 1, .1, 10000.0));
    rtt.setRenderOrder(osg.Camera.PRE_RENDER, 0);
    rtt.setReferenceFrame(osg.Transform.ABSOLUTE_RF);
    rtt.setViewport(new osg.Viewport(0, 0, rttSize[0], rttSize[1]));

    var rttTexture = new osg.Texture();

    rttTexture.wrap_s = 'CLAMP_TO_EDGE';
    rttTexture.wrap_t = 'CLAMP_TO_EDGE';
    rttTexture.setTextureSize(rttSize[0], rttSize[1]);
    rttTexture.setMinFilter('NEAREST');
    rttTexture.setMagFilter('NEAREST');

    rtt.attachTexture(gl.COLOR_ATTACHMENT0, rttTexture, 0);

    rtt.setClearDepth(1.0);
    rtt.setClearMask(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var CameraTexturePair = {};
    // rtt.setStateSet(new osg.StateSet());
    rtt.getOrCreateStateSet().setAttribute(GetDepthShader());
    rtt.getOrCreateStateSet().setAttribute(new osg.BlendFunc('ONE', 'ZERO'));
    rtt.setClearColor([ 0, 0, 0, 1 ]);
    CameraTexturePair.camera = rtt;
    CameraTexturePair.texture = rttTexture;
    return CameraTexturePair;
}

function onJSONLoaded(data) {

    WebGL.gviewer.canvas.width = WebGL.gviewer.canvas.clientWidth;
    WebGL.gviewer.canvas.height = WebGL.gviewer.canvas.clientHeight;

    // alert(JSON.stringify(data));
    o = ParseSceneGraph(data, Texture_Load_Callback);

    WebGL.gCamera = new osg.Camera();

    WebGL.gCamera.setRenderOrder(osg.Camera.NESTED_RENDER, 0);
    WebGL.gCamera.setReferenceFrame(osg.Transform.ABSOLUTE_RF);
    WebGL.gCamera.setViewport(new osg.Viewport(0, 0, WebGL.gviewer.canvas.clientWidth,
	    WebGL.gviewer.canvas.clientHeight));

    WebGL.gModelRoot = osg.MatrixTransform.create();
    WebGL.gModelRoot.addChild(o);
    
    WebGL.gModelRoot.accept(new ShaderUniformVisitor());
    
    var bv = new BoundsVisitor();

    WebGL.gCamera.addChild(WebGL.gModelRoot);
    WebGL.gCamera.accept(new AmbientVisitor([ .5, .5, .5, 1 ]));

    var ratio = WebGL.gviewer.canvas.clientWidth / WebGL.gviewer.canvas.clientHeight;

    WebGL.gSceneRoot = WebGL.gCamera;

    
    bv.apply(WebGL.gModelRoot);
    WebGL.gSceneBounds = bv.asBoundingBox();
    WebGL.gOriginalSceneBounds = new BoundingBox(WebGL.gSceneBounds.points);
    
    WebGlSetUnitScale(WebGL.tempScale);
 //   WebGL.gCamera.addChild(CreateBoundsGeometry(WebGL.gSceneBounds.points));
    var radius = WebGL.gSceneBounds.GetRadius();

    WebGL.gCameraOffset = [ radius, radius, radius ];
    WebGL.gCameraTarget = WebGL.gSceneBounds.GetCenter();
    UpdateCamera();

    //WebGL.gGridNode = BuildGridGeometry();

    WebGL.gCamera.addChild(WebGL.gGridNode);
    WebGL.gCamera.getOrCreateStateSet().setAttribute(
	    new osg.BlendFunc("ONE", "ONE_MINUS_SRC_ALPHA"));

    var CameraTexturePair = BuildShadowCamera();

    WebGL.g_RTT = CameraTexturePair.camera;
    // WebGL.gCamera.addChild(CameraTexturePair.camera);
    CameraTexturePair.camera.addChild(WebGL.gModelRoot);
    CameraTexturePair.camera.setViewMatrix(osg.Matrix.makeLookAt(WebGL.gCameraOffset,
	    WebGL.gCameraTarget, WebGL.gUpVector));

    // var rq = osg.createTexuredQuad(10 / 2.0, .001, -10 / 2.0,
    // -10, 0, 0, 0, 0, 10, WebGL.gSceneBounds.GetRadius(),
    // WebGL.gSceneBounds.GetRadius(), 0, 0);
    // rq.getOrCreateStateSet().setTextureAttribute(0,CameraTexturePair.texture);

    WebGL.gCamera.getOrCreateStateSet().setAttribute(GetRecieveShadows());
    WebGL.gCamera.getOrCreateStateSet().setTextureAttribute(3,
	    CameraTexturePair.texture);
    WebGL.gCamera.getOrCreateStateSet().addUniform(
	    osg.Uniform.createInt1(3, 'shadowmap'));
    WebGL.gCamera.getOrCreateStateSet().addUniform(
	    osg.Uniform.createInt1(0, 'texture'));
    WebGL.gCanvasSizeUniform = osg.Uniform.createFloat2([ WebGL.gviewer.canvas.clientWidth,
	    WebGL.gviewer.canvas.clientHeight ], 'canvasSize');
    WebGL.gCamera.getOrCreateStateSet().addUniform(WebGL.gCanvasSizeUniform);
    UpdateCamera();

    WebGL.ViewMatrixUniform = osg.Uniform.createMatrix4(osg.Matrix.inverse(WebGL.gCamera
	    .getViewMatrix()), 'inverseViewMatrix');
    WebGL.ShadowMatrixUniform = osg.Uniform.createMatrix4(osg.Matrix.mult(WebGL.g_RTT
	    .getProjectionMatrix(), WebGL.g_RTT.getViewMatrix()), 'shadowProjection');
    WebGL.gCamera.getOrCreateStateSet().addUniform(WebGL.ShadowMatrixUniform);
    WebGL.gCamera.getOrCreateStateSet().addUniform(WebGL.ViewMatrixUniform);
    // WebGL.gCamera.addChild(rq);

    WebGL.gviewer.setScene(WebGL.gCamera);

    WebGL.gCamera.setClearColor([ 1, 1, 1, 1 ]);

    WebGL.gCamera.setViewMatrix(osg.Matrix.makeLookAt(WebGL.gCameraOffset, WebGL.gCameraTarget,
	    WebGL.gUpVector));
    WebGL.gCamera.setProjectionMatrix(osg.Matrix.makePerspective(60, ratio, .01,
	    10000));

    // WebGL.gCamera.setProjectionMatrix(osg.Matrix.makeOrtho(-10, 10, -10, 10, -0,
    // 10000.0));
    WebGL.gviewer.view.setClearColor([ 1, 1, 1, 1 ]);
    WebGL.gviewer.view.addChild(CameraTexturePair.camera);
    WebGL.gviewer.scene.setUpdateCallback(new AnimationCallback);
    WebGL.gviewer.view.getOrCreateStateSet(new osg.Depth());
    
    
    
    WebGlSetUpVector(WebGL.tempUpVec);
    
    
     
    
    WebGL.gviewer.run();
    

}

var AmbientVisitor = function(incolor) {
    osg.NodeVisitor.call(this);
    this.color = incolor;
};
AmbientVisitor.prototype = osg.objectInehrit(osg.NodeVisitor.prototype, {
    apply : function(node) {
	if (node.traverse) {
	    var ss = node.getStateSet();
	    if (ss) {
		var AttMap = ss.getAttributeMap();
		var material = AttMap.Material;
		if (material) {
		    material.ambient = this.color;
		}
	    }
	    this.traverse(node);
	}
    }
});

var DepthCheckVisitor = function() {
    osg.NodeVisitor.call(this);
};
DepthCheckVisitor.prototype = osg.objectInehrit(osg.NodeVisitor.prototype, {
    apply : function(node) {
	if (node.traverse) {
	    var ss = node.getStateSet();
	    if (ss) {
		ss.setAttribute(new osg.Depth());
	    }
	    this.traverse(node);
	}
    }
});
var WireframeVisitor = function() {
    osg.NodeVisitor.call(this);
};
WireframeVisitor.prototype = osg.objectInehrit(osg.NodeVisitor.prototype, {
    apply : function(node) {
	if (node.traverse) {
	    if (node.getPrimitives) {
		var PrimitiveList = node.getPrimitives();
		for ( var i = 0; i < PrimitiveList.length; i++) {
		    PrimitiveList[i].mode = gl.LINES;
		}
	    }
	    this.traverse(node);
	}
    }
});

var ShaderUniformVisitor = function() {
    osg.NodeVisitor.call(this);
};
ShaderUniformVisitor.prototype = osg.objectInehrit(osg.NodeVisitor.prototype, {
    apply : function(node) {
	if (node.traverse) {
	    var ss = node.getStateSet();
	    if (ss) {
		var map = ss.getAttributeMap();
		var keys = map.attributeKeys;
		for(var i = 0; i < keys.length; i++)
		    {
		    	var att = map[keys[i]];
		    	
		    	if(att.attributeType == 'Material')
		    	{
		    	
		    	    var texturekeys = false;
		    	    if(ss.textureAttributeMapList)
		    		texturekeys = ss.textureAttributeMapList.length > 0 ? true : false;
		    	    if(!texturekeys)
		    		{
		    			//create uniform for that material
		    			//alert("this one needs uniform!");
		    			var uniform = osg.Uniform.createFloat4(att.diffuse,'MaterialDiffuse');
		    			ss.addUniform(uniform);
		    		}
		    	    
		    	    
		    	}
		    }
	    }
	    this.traverse(node);
	}
    }
});

var BoundsVisitor = function() {
    osg.NodeVisitor.call(this);
    this.currentbounds = [];
};
BoundsVisitor.prototype = osg.objectInehrit(osg.NodeVisitor.prototype, {
    asBoundingBox : function() {
	return new BoundingBox(this.currentbounds);
    },
    transformArray : function(matrix, array) {
	for ( var i = 0; i < array.length; i += 3) {
	    var vec3 = [ array[i], array[i + 1], array[i + 2] ];
	    vec3 = osg.Matrix.transformVec3(matrix, vec3);
	    array[i] = vec3[0];
	    array[i + 1] = vec3[1];
	    array[i + 2] = vec3[2];
	}
	return array;
    },
    boundsFromArray : function(array) {
	// alert(array);
	var minx = 10000000;
	var miny = 10000000;
	var minz = 10000000;
	var maxx = -10000000;
	var maxy = -10000000;
	var maxz = -10000000;
	if (array.length < 3)
	    return [];
	for ( var i = 0; i < array.length; i += 3) {
	    if (array[i] < minx)
		minx = array[i];

	    if (array[i + 1] < miny)
		miny = array[i + 1];

	    if (array[i + 2] < minz)
		minz = array[i + 2];

	    if (array[i] > maxx)
		maxx = array[i];

	    if (array[i + 1] > maxy)
		maxy = array[i + 1];

	    if (array[i + 2] > maxz)
		maxz = array[i + 2];
	}
	// alert([minx,miny,minz,maxx,maxy,maxz]);
	return [ minx, miny, minz, minx, miny, maxz, minx, maxy, minz, minx,
		maxy, maxz, maxx, miny, minz, maxx, miny, maxz, maxx, maxy,
		minz, maxx, maxy, maxz ];

    },
    apply : function(node) {
	if (node.traverse) {
	    if (node.getPrimitives) {
		// alert("traversing geometry")
		var VertBuffer = node.getAttributes().Vertex;
		if (VertBuffer) {
		    this.currentbounds = this
			    .boundsFromArray(VertBuffer.elements);
		    return this.currentbounds;
		}
	    } else if (node.matrix) {
		// alert("traversing matrix")
		var points = [];
		for ( var i = 0; i < node.children.length; i++) {
		    points = points.concat(this.apply(node.children[i]));
		    // alert(node.name + points);
		}
		this.currentbounds = this.transformArray(node.matrix, this
			.boundsFromArray(points));
		// WebGL.gSceneRoot.addChild(CreateBoundsGeometry(this.currentbounds));
		return this.currentbounds;
	    } else if (node.children) {
		var points = [];
		for ( var i = 0; i < node.children.length; i++) {
		    points = points.concat(this.apply(node.children[i]));
		    // alert(node.name + points);
		}
		this.currentbounds = this.boundsFromArray(points);
		return this.currentbounds;
	    }

	}
    }
});

function ApplyWireframe() {
    WebGL.gModelRoot.accept(new WireframeVisitor());
    WebGL.gWireframeButton.onclick = UndoWireframe;
}
function UndoWireframe() {
    WebGL.gModelRoot.accept(new UnWireframeVisitor());
    WebGL.gWireframeButton.onclick = ApplyWireframe;
}

var UnWireframeVisitor = function() {
    osg.NodeVisitor.call(this);
};
UnWireframeVisitor.prototype = osg.objectInehrit(osg.NodeVisitor.prototype, {
    apply : function(node) {
	if (node.traverse) {
	    if (node.getPrimitives) {
		var PrimitiveList = node.getPrimitives();
		for ( var i = 0; i < PrimitiveList.length; i++) {
		    PrimitiveList[i].mode = gl.TRIANGLES;
		}
	    }
	    this.traverse(node);
	}
    }
});

function createScene(viewer, url) {
    WebGL.gURL = url;

    // override texture constructor to set the wrap mode repeat for all texture
    osg.Texture.prototype.setDefaultParameters = function() {
	this.mag_filter = 'LINEAR';
	this.min_filter = 'LINEAR_MIPMAP_LINEAR';
	this.wrap_s = 'REPEAT';
	this.wrap_t = 'REPEAT';
	this.textureWidth = 0;
	this.textureHeight = 0;
	this.target = 'TEXTURE_2D';
    };

    jQuery.ajaxSetup({
	'beforeSend' : function(xhr) {
	    if (xhr.overrideMimeType)
		xhr.overrideMimeType("text/plain");
	}
    });

    jQuery.ajaxSetup({
	"error" : function(XMLHttpRequest, textStatus, errorThrown) {
	    alert(textStatus);
	    alert(errorThrown);
	    alert(XMLHttpRequest.responseText);
	}
    });

    jQuery.getJSON(url, {}, onJSONLoaded);

};

function ParseSceneGraph(node, texture_load_callback) {

    var newnode;
    if (node.primitives) {
	newnode = osg.Geometry.create();
	jQuery.extend(newnode, node);
	node = newnode;

	var i;
	for (i in node.primitives) {
	    var mode = node.primitives[i].mode;
	    if (node.primitives[i].indices) {
		var array = node.primitives[i].indices;
		array = osg.BufferArray.create(gl[array.type], array.elements,
			array.itemSize);
		if (!mode) {
		    mode = gl.TRIANGLES;
		} else {
		    mode = gl[mode];
		}
		node.primitives[i] = osg.DrawElements.create(mode, array);
	    } else {
		mode = gl[mode];
		var first = node.primitives[i].first;
		var count = node.primitives[i].count;
		if (count > 65535)
		    count = 32740;
		node.primitives[i] = new osg.DrawArrays(mode, first, count);
	    }
	}
    }

    if (node.attributes) {
	jQuery.each(node.attributes, function(key, element) {
	    var attributeArray = node.attributes[key];
	    node.attributes[key] = osg.BufferArray.create(
		    gl[attributeArray.type], attributeArray.elements,
		    attributeArray.itemSize);
	});
    }

    if (node.stateset) {
	var newstateset = new osg.StateSet();
	if (node.stateset.textures) {
	    var textures = node.stateset.textures;
	    for ( var t = 0, tl = textures.length; t < tl; t++) {
		if (textures[t] === undefined) {
		    continue;
		}
		if (!textures[t].file) {
		    if (console !== undefined) {
			console.log("no 'file' field for texture "
				+ textures[t]);
		    }
		}

		var tex;
		if (texture_load_callback)
		    tex = texture_load_callback(textures[t].file);
		else
		    tex = osg.Texture.create(textures[t].file);

		newstateset.setTexture(t, tex);
		newstateset
			.addUniform(osg.Uniform.createInt1(t, "Texture" + t));
	    }
	}
	if (node.stateset.material) {
	    var material = node.stateset.material;
	    var newmaterial = osg.Material.create();
	    jQuery.extend(newmaterial, material);
	    newstateset.setAttribute(newmaterial);
	}
	node.stateset = newstateset;
    }

    if (node.matrix) {
	newnode = new osg.MatrixTransform();
	jQuery.extend(newnode, node);
	newnode.setMatrix(osg.Matrix.copy(node.matrix));
	node = newnode;
    }

    if (node.projection) {
	newnode = new osg.Projection();
	jQuery.extend(newnode, node);
	newnode.setProjectionMatrix(osg.Matrix.copy(node.projection));
	node = newnode;
    }

    if (node.children) {
	newnode = new osg.Node();
	jQuery.extend(newnode, node);
	node = newnode;

	for ( var child = 0, childLength = node.children.length; child < childLength; child++) {
	    node.children[child] = ParseSceneGraph(node.children[child],
		    texture_load_callback);
	}
    }

    // no properties then we create a node by default
    if (node.accept === undefined) {
	newnode = new osg.Node();
	jQuery.extend(newnode, node);
	node = newnode;
    }

    return node;
}
