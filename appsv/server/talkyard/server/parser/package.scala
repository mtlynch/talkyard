package talkyard.server

import com.debiki.core._
import com.debiki.core.Prelude.dieIf


/** Parsers and serializers, e.g. from-to JSON or from PASETO token claims.
  *
  * Package name "parser" = "*par*se and *ser*ialize".
  *
  */
package object parser {


  def throwBadInpDataIf(test: Bo, errCode: ErrCode, message: => St): U =
    if (test)
      throwBadInpData(errCode, message = message)

  def throwBadInpData(errCode: ErrCode, message: St) =
    throw new BadInpDataEx(s"$message [$errCode]")


  class BadInpDataEx(message: ErrMsg) extends QuickException {
    override def getMessage: St = message
  }

  // How to serialize things to JSON — different flags, for backw compat.
  /**
    *
    * @param v0_1 — just "id" instead of "pageId" and "ppId".
    */
  case class JsonConf(v0_0: Bo = false, v0_1: Bo = false, pretty: Bo = false) {
    dieIf(!v0_0 && !v0_1, "TyE7MRKRD3067A")
    dieIf(v0_0 && v0_1, "TyE7MRKRD3067B")

    def inclOldPageIdField: Bo = v0_0
    def inclOldPpIdField: Bo = v0_0
    def inclOldCategoryIdField: Bo = v0_0
  }

  object JsonConf {
    private val _v0_0: JsonConf = JsonConf(v0_0 = true)
    private val _v0_1: JsonConf = JsonConf(v0_1 = true)

    def v0_0(pretty: Bo = false): JsonConf =
      if (!pretty) _v0_0
      else _v0_0.copy(pretty = pretty)

    def v0_1(pretty: Bo = false): JsonConf =
      if (!pretty) _v0_1
      else _v0_1.copy(pretty = pretty)
  }
}
