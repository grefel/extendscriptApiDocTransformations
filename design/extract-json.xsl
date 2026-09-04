<?xml version="1.0" encoding="UTF-8"?>
<!-- Erzeugt aus dem gefixten DOM eine kompakte JSON-Datei fuer die Layout-Prototypen.
     Nur fuer die Design-Phase gedacht, nicht Teil der spaeteren Transformation.

     Struktur je Klasse:
       n/d/sup/enum  Name, Beschreibung, Superklasse, Enum-Flag
       p[]           Properties (bei Enums: die Werte). st=1 -> statisch (Klassenebene)
       ev[]          Events (Klassenebene, Beschreibung beginnt mit "Dispatched")
       m[]           Methoden inkl. Rueckgabetyp r[] und Parametern a[]
     Typlisten tragen arr=1, wenn <datatype><array/> gesetzt ist (Collection). -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:px="http://www.publishingx.de"
	exclude-result-prefixes="xs px" version="2.0">

	<xsl:output method="text" encoding="UTF-8"/>
	<xsl:strip-space elements="*"/>

	<!-- JSON-String-Escaping: Reihenfolge wichtig, Backslash zuerst. -->
	<xsl:function name="px:j" as="xs:string">
		<xsl:param name="s" as="xs:string?"/>
		<xsl:variable name="t" select="normalize-space(string($s))"/>
		<xsl:variable name="t" select="replace($t, '\\', '\\\\')"/>
		<xsl:variable name="t" select="replace($t, '&quot;', '\\&quot;')"/>
		<xsl:sequence select="concat('&quot;', $t, '&quot;')"/>
	</xsl:function>

	<!-- Mehrfache datatype/type werden zu einer Liste; "Varies" ist ein Platzhalter
	     Adobes und wird verworfen, sobald konkretere Typen danebenstehen. -->
	<xsl:function name="px:types" as="xs:string">
		<xsl:param name="n" as="element()?"/>
		<xsl:variable name="all" select="$n/datatype/type[normalize-space()]"/>
		<xsl:variable name="use" select="if (count($all) &gt; 1) then $all[. != 'Varies'] else $all"/>
		<xsl:sequence select="string-join(for $t in $use return px:j($t), ',')"/>
	</xsl:function>

	<!-- Events sind Klassenkonstanten; Adobe kennzeichnet sie nur ueber den
	     Beschreibungstext. Statische Properties wie $.build bleiben Properties. -->
	<xsl:function name="px:isEvent" as="xs:boolean">
		<xsl:param name="p" as="element()"/>
		<xsl:sequence select="starts-with(normalize-space(($p/shortdesc, $p/description)[1]), 'Dispatched')"/>
	</xsl:function>

	<!-- fixDom.xsl leitet aus den Beschreibungen zwei Angaben ab, die sonst verloren
	     gehen: Wertebereiche (<min>/<max>, aus "range of 0 to 100") und die Markierung
	     "Measurement Unit" fuer Werte, die auch als "12mm" geschrieben werden duerfen. -->
	<xsl:template name="extras">
		<xsl:param name="n" as="element()"/>
		<!-- Klammern noetig: $n/datatype/min[1] liefert je datatype das erste min,
		     nicht das erste ueber alle datatype-Geschwister. -->
		<xsl:variable name="min" select="($n/datatype/min[normalize-space()])[1]"/>
		<xsl:variable name="max" select="($n/datatype/max[normalize-space()])[1]"/>
		<xsl:if test="$min or $max">
			<xsl:text>,"rng":[</xsl:text>
			<xsl:value-of select="px:j($min)"/>
			<xsl:text>,</xsl:text>
			<xsl:value-of select="px:j($max)"/>
			<xsl:text>]</xsl:text>
		</xsl:if>
		<xsl:if test="$n/datatype/is = 'Measurement Unit'">
			<xsl:text>,"mu":1</xsl:text>
		</xsl:if>
	</xsl:template>

	<xsl:template name="prop">
		<xsl:param name="p" as="element()"/>
		<xsl:param name="static" as="xs:boolean" select="false()"/>
		<xsl:text>{"n":</xsl:text>
		<xsl:value-of select="px:j($p/@name)"/>
		<xsl:text>,"t":[</xsl:text>
		<xsl:value-of select="px:types($p)"/>
		<xsl:text>],"rw":</xsl:text>
		<xsl:value-of select="px:j($p/@rwaccess)"/>
		<xsl:text>,"d":</xsl:text>
		<xsl:value-of select="px:j(($p/shortdesc, $p/description)[1])"/>
		<xsl:if test="$p/datatype/array">
			<xsl:text>,"arr":1</xsl:text>
		</xsl:if>
		<xsl:call-template name="extras"><xsl:with-param name="n" select="$p"/></xsl:call-template>
		<xsl:if test="$p/datatype/value">
			<xsl:text>,"v":</xsl:text>
			<xsl:value-of select="px:j($p/datatype[1]/value[1])"/>
		</xsl:if>
		<xsl:if test="$static">
			<xsl:text>,"st":1</xsl:text>
		</xsl:if>
		<xsl:text>}</xsl:text>
	</xsl:template>

	<xsl:template match="/">
		<xsl:text>{"version":</xsl:text>
		<xsl:value-of select="px:j(/domRoot/product/dictionary/map/@title)"/>
		<!-- Erzeugungsdatum gehoert in die Daten, nicht in die Seite. -->
		<xsl:text>,"generated":</xsl:text>
		<xsl:value-of select="px:j(format-date(current-date(), '[Y0001]-[M01]-[D01]'))"/>
		<xsl:text>,"classes":[</xsl:text>
		<xsl:for-each select="//classdef">
			<xsl:sort select="@name"/>
			<xsl:variable name="isEnum" select="@enumeration = 'true'"/>
			<!-- Bei Enums sind die Klassen-Properties die Werte, sonst Events/Statics. -->
			<xsl:variable name="clsProps" select="elements[@type = 'class']/property"/>
			<xsl:variable name="events" select="if ($isEnum) then () else $clsProps[px:isEvent(.)]"/>
			<xsl:variable name="statics" select="if ($isEnum) then () else $clsProps[not(px:isEvent(.))]"/>
			<xsl:variable name="inst" select="elements[@type = 'instance']/property"/>

			<xsl:if test="position() &gt; 1">,</xsl:if>
			<xsl:text>{"n":</xsl:text>
			<xsl:value-of select="px:j(@name)"/>
			<xsl:text>,"d":</xsl:text>
			<xsl:value-of select="px:j((shortdesc, description)[1])"/>
			<xsl:if test="$isEnum">
				<xsl:text>,"enum":1</xsl:text>
			</xsl:if>
			<xsl:if test="superclass">
				<xsl:text>,"sup":</xsl:text>
				<xsl:value-of select="px:j(superclass[1])"/>
			</xsl:if>

			<xsl:text>,"p":[</xsl:text>
			<xsl:for-each select="if ($isEnum) then $clsProps else ($statics, $inst)">
				<xsl:sort select="@name"/>
				<xsl:if test="position() &gt; 1">,</xsl:if>
				<xsl:call-template name="prop">
					<xsl:with-param name="p" select="."/>
					<xsl:with-param name="static" select="not($isEnum) and parent::elements/@type = 'class'"/>
				</xsl:call-template>
			</xsl:for-each>
			<xsl:text>]</xsl:text>

			<xsl:text>,"ev":[</xsl:text>
			<xsl:for-each select="$events">
				<xsl:sort select="@name"/>
				<xsl:if test="position() &gt; 1">,</xsl:if>
				<xsl:text>{"n":</xsl:text>
				<xsl:value-of select="px:j(@name)"/>
				<xsl:text>,"d":</xsl:text>
				<xsl:value-of select="px:j((shortdesc, description)[1])"/>
				<xsl:text>}</xsl:text>
			</xsl:for-each>
			<xsl:text>]</xsl:text>

			<xsl:text>,"m":[</xsl:text>
			<xsl:for-each select="elements/method">
				<xsl:sort select="@name"/>
				<xsl:if test="position() &gt; 1">,</xsl:if>
				<xsl:text>{"n":</xsl:text>
				<xsl:value-of select="px:j(@name)"/>
				<!-- Rueckgabetyp haengt direkt an <method>, es gibt kein <returns>. -->
				<xsl:text>,"r":[</xsl:text>
				<xsl:value-of select="px:types(.)"/>
				<xsl:text>]</xsl:text>
				<xsl:if test="datatype/array">
					<xsl:text>,"rarr":1</xsl:text>
				</xsl:if>
				<xsl:text>,"d":</xsl:text>
				<xsl:value-of select="px:j((shortdesc, description)[1])"/>
				<xsl:text>,"a":[</xsl:text>
				<xsl:for-each select="parameters/parameter">
					<xsl:if test="position() &gt; 1">,</xsl:if>
					<xsl:text>{"n":</xsl:text>
					<xsl:value-of select="px:j(@name)"/>
					<xsl:text>,"t":[</xsl:text>
					<xsl:value-of select="px:types(.)"/>
					<xsl:text>],"d":</xsl:text>
					<xsl:value-of select="px:j((shortdesc, description)[1])"/>
					<xsl:if test="datatype/array">
						<xsl:text>,"arr":1</xsl:text>
					</xsl:if>
					<xsl:call-template name="extras"><xsl:with-param name="n" select="."/></xsl:call-template>
					<!-- Adobe markiert optionale Parameter uneinheitlich: teils @optional,
					     teils nur per "(Optional)" am Ende der Beschreibung. -->
					<xsl:if test="@optional = 'true' or ends-with(normalize-space((shortdesc, description)[1]), '(Optional)')">
						<xsl:text>,"o":1</xsl:text>
					</xsl:if>
					<xsl:text>}</xsl:text>
				</xsl:for-each>
				<xsl:text>]}</xsl:text>
			</xsl:for-each>
			<xsl:text>]}</xsl:text>
		</xsl:for-each>
		<xsl:text>]}</xsl:text>
	</xsl:template>

</xsl:stylesheet>
