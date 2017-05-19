/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package com.debiki.core



sealed abstract class TrustLevel(val IntVal: Int) { def toInt = IntVal }

/** The same as Discourse's trust levels, plus one more level: the helpful member,
  *
  * Discourse's trust levels:
  * https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/6
  *
  * About the additional trust level:
  * https://meta.discourse.org/t/a-new-trust-level-the-helpful-member/56894
  */
object TrustLevel {
  case object New extends TrustLevel(1)
  case object Basic extends TrustLevel(2)
  case object FullMember extends TrustLevel(3)
  case object Helper extends TrustLevel(4)   // or rename to Trusted?
  case object Regular extends TrustLevel(5)
  case object CoreMember extends TrustLevel(6)

  // Not real trust levels, but sometimes simpler to remember just one digit, say 7,
  // instead of 3 things: level + isMod + isAdm.
  val StrangerDummyLevel = 0
  val ModeratorDummyLevel = 7
  val AdminDummyLevel = 8

  def fromInt(value: Int): Option[TrustLevel] = Some(value match {
    case TrustLevel.New.IntVal => TrustLevel.New
    case TrustLevel.Basic.IntVal => TrustLevel.Basic
    case TrustLevel.FullMember.IntVal => TrustLevel.FullMember
    case TrustLevel.Helper.IntVal => TrustLevel.Helper
    case TrustLevel.Regular.IntVal => TrustLevel.Regular
    case TrustLevel.CoreMember.IntVal => TrustLevel.CoreMember
    case _ => return None
  })
}



sealed abstract class ThreatLevel(val IntVal: Int) {
  def toInt = IntVal
  def isSevereOrWorse = false
}

object ThreatLevel {

  case object SuperSafe extends ThreatLevel(1)

  case object SeemsSafe extends ThreatLevel(2)

  /** The default. */
  case object HopefullySafe extends ThreatLevel(3)

  /** All comments will be published directly, but also added to the moderation queue for review. */
  case object MildThreat extends ThreatLevel(4)

  /** Comments won't be published until they've been approved by a moderator. */
  case object ModerateThreat extends ThreatLevel(5)

  /** May not post any comments at all. */
  case object SevereThreat extends ThreatLevel(6) {
    override def isSevereOrWorse = true
  }

  def fromInt(value: Int): Option[ThreatLevel] = Some(value match {
    case ThreatLevel.HopefullySafe.IntVal => ThreatLevel.HopefullySafe
    case ThreatLevel.MildThreat.IntVal => ThreatLevel.MildThreat
    case ThreatLevel.ModerateThreat.IntVal => ThreatLevel.ModerateThreat
    case ThreatLevel.SevereThreat.IntVal => ThreatLevel.SevereThreat
    case _ => return None
  })
}

